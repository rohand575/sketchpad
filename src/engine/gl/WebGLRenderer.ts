import type { BlendMode, Camera, SketchDocument, StrokeElement } from '@/model/types'
import type { LiveStroke, PaintEngine, SceneInput } from '@/engine/renderer/types'
import { getBrush, type Brush, type GrainKind, type ShapeKind } from '@/engine/brushes/library'
import { GLContext, generateGrainData, generateShapeData, TEXTURE_SIZES, type GLTarget, type Program } from './GLContext'
import { StrokeStamper, type Dab } from './BrushEngine'
import {
  LAYER_COMPOSITE_FRAG,
  FULL_VERT_SRC,
  SCREEN_FRAG,
  SCREEN_VERT,
  STAMP_FRAG,
  STAMP_VERT,
  STROKE_COMPOSITE_FRAG,
} from './shaders'

const BLEND_ENUM: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  'color-dodge': 6,
  add: 7,
  'soft-light': 8,
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

interface LiveState {
  live: LiveStroke
  brush: Brush
  stamper: StrokeStamper
  rgb: [number, number, number]
}

export class WebGLRenderer implements PaintEngine {
  private canvas!: HTMLCanvasElement
  private glc!: GLContext
  private gl!: WebGL2RenderingContext

  private pStamp!: Program
  private pStroke!: Program
  private pLayer!: Program
  private pScreen!: Program

  private shapes = new Map<ShapeKind, WebGLTexture>()
  private grains = new Map<Exclude<GrainKind, null>, WebGLTexture>()

  private docW = 0
  private docH = 0
  private layers = new Map<string, GLTarget>()
  private layerBaked = new Map<string, number>()
  private accumA: GLTarget | null = null
  private accumB: GLTarget | null = null
  private scratch: GLTarget | null = null
  private work: GLTarget | null = null

  private liveState: LiveState | null = null

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.glc = new GLContext(canvas)
    this.gl = this.glc.gl
    this.pStamp = this.glc.program(STAMP_VERT, STAMP_FRAG)
    this.pStroke = this.glc.program(FULL_VERT_SRC, STROKE_COMPOSITE_FRAG)
    this.pLayer = this.glc.program(FULL_VERT_SRC, LAYER_COMPOSITE_FRAG)
    this.pScreen = this.glc.program(SCREEN_VERT, SCREEN_FRAG)
  }

  dispose(): void {
    const glc = this.glc
    if (!glc) return
    this.layers.forEach((t) => glc.deleteTarget(t))
    this.layers.clear()
    ;[this.accumA, this.accumB, this.scratch, this.work].forEach((t) => t && glc.deleteTarget(t))
    this.accumA = this.accumB = this.scratch = this.work = null
    this.shapes.forEach((t) => this.gl.deleteTexture(t))
    this.grains.forEach((t) => this.gl.deleteTexture(t))
  }

  // --- textures ---
  private shapeTex(kind: ShapeKind): WebGLTexture {
    let t = this.shapes.get(kind)
    if (!t) {
      t = this.glc.createTexture(TEXTURE_SIZES.shape, TEXTURE_SIZES.shape, generateShapeData(kind))
      this.shapes.set(kind, t)
    }
    return t
  }
  private grainTex(kind: Exclude<GrainKind, null>): WebGLTexture {
    let t = this.grains.get(kind)
    if (!t) {
      const data = generateGrainData(kind)
      t = this.glc.createTexture(TEXTURE_SIZES.grain, TEXTURE_SIZES.grain, data, {
        wrap: this.gl.REPEAT,
      })
      this.grains.set(kind, t)
    }
    return t
  }

  // --- targets ---
  private ensureTargets(doc: SketchDocument): void {
    if (doc.width === this.docW && doc.height === this.docH && this.accumA) return
    // size changed: rebuild everything
    this.layers.forEach((t) => this.glc.deleteTarget(t))
    this.layers.clear()
    this.layerBaked.clear()
    ;[this.accumA, this.accumB, this.scratch, this.work].forEach((t) => t && this.glc.deleteTarget(t))
    this.docW = doc.width
    this.docH = doc.height
    this.accumA = this.glc.createTarget(this.docW, this.docH)
    this.accumB = this.glc.createTarget(this.docW, this.docH)
    this.scratch = this.glc.createTarget(this.docW, this.docH)
    this.work = this.glc.createTarget(this.docW, this.docH)
  }

  private layerTarget(id: string): GLTarget {
    let t = this.layers.get(id)
    if (!t) {
      t = this.glc.createTarget(this.docW, this.docH)
      this.layers.set(id, t)
    }
    return t
  }

  private bindTex(unit: number, tex: WebGLTexture): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
  }

  // --- dab rendering into the scratch buffer ---
  private drawDabs(dabs: Dab[], brush: Brush, rgb: [number, number, number]): void {
    if (dabs.length === 0) return
    const gl = this.gl
    this.glc.bindTarget(this.scratch!)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // premultiplied source-over
    this.pStamp.use()
    this.bindTex(0, this.shapeTex(brush.shape))
    gl.uniform1i(this.pStamp.loc('uShape'), 0)
    const useGrain = brush.grain !== null
    gl.uniform1i(this.pStamp.loc('uUseGrain'), useGrain ? 1 : 0)
    if (useGrain) {
      this.bindTex(1, this.grainTex(brush.grain as Exclude<GrainKind, null>))
      gl.uniform1i(this.pStamp.loc('uGrain'), 1)
      gl.uniform1f(this.pStamp.loc('uGrainScale'), brush.grainScale)
    }
    gl.uniform2f(this.pStamp.loc('uResolution'), this.docW, this.docH)
    gl.uniform3f(this.pStamp.loc('uColor'), rgb[0], rgb[1], rgb[2])
    for (const d of dabs) {
      gl.uniform2f(this.pStamp.loc('uCenter'), d.x, d.y)
      gl.uniform1f(this.pStamp.loc('uSize'), d.size)
      gl.uniform1f(this.pStamp.loc('uAngle'), d.angle)
      gl.uniform1f(this.pStamp.loc('uFlow'), Math.min(1, d.flow))
      this.glc.drawQuad()
    }
  }

  /** Composite scratch over `base` into `work`, honoring opacity/mode/erase/alpha-lock. */
  private strokeIntoWork(base: GLTarget, opacity: number, mode: number, erase: boolean, alphaLock: boolean): void {
    const gl = this.gl
    this.glc.bindTarget(this.work!)
    gl.disable(gl.BLEND)
    this.pStroke.use()
    this.bindTex(0, base.tex)
    gl.uniform1i(this.pStroke.loc('uBase'), 0)
    this.bindTex(1, this.scratch!.tex)
    gl.uniform1i(this.pStroke.loc('uStroke'), 1)
    gl.uniform1f(this.pStroke.loc('uOpacity'), opacity)
    gl.uniform1i(this.pStroke.loc('uMode'), mode)
    gl.uniform1i(this.pStroke.loc('uErase'), erase ? 1 : 0)
    gl.uniform1i(this.pStroke.loc('uAlphaLock'), alphaLock ? 1 : 0)
    this.glc.drawQuad()
  }

  private clearTarget(t: GLTarget, r = 0, g = 0, b = 0, a = 0): void {
    const gl = this.gl
    this.glc.bindTarget(t)
    gl.disable(gl.BLEND)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private blit(src: GLTarget, dst: GLTarget): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbo)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fbo)
    gl.blitFramebuffer(0, 0, src.width, src.height, 0, 0, dst.width, dst.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** Bake a single stroke's scratch onto its layer target. */
  private applyStrokeToLayer(layer: GLTarget, stroke: {
    opacity: number
    erase: boolean
    mode: number
    alphaLock: boolean
  }): void {
    this.strokeIntoWork(layer, stroke.opacity, stroke.mode, stroke.erase, stroke.alphaLock)
    this.blit(this.work!, layer)
  }

  /** Replay all strokes of a layer into its texture. */
  private bakeLayer(layerId: string, doc: SketchDocument): void {
    const target = this.layerTarget(layerId)
    this.clearTarget(target, 0, 0, 0, 0)
    for (const el of doc.elements) {
      if (el.layerId !== layerId || el.type !== 'stroke') continue
      const stroke = el as StrokeElement
      const brush = getBrush(stroke.brushId)
      this.clearTarget(this.scratch!, 0, 0, 0, 0)
      const stamper = new StrokeStamper(brush, stroke.size)
      const dabs = stamper.addPoints(stroke.points)
      this.drawDabs(dabs, brush, hexToRgb(stroke.color))
      this.applyStrokeToLayer(target, {
        opacity: stroke.opacity,
        erase: brush.erase,
        mode: brush.composite === 'multiply' ? 1 : 0,
        alphaLock: !!stroke.alphaLock,
      })
    }
  }

  private ensureLayers(doc: SketchDocument, layerVersion: Record<string, number>): void {
    for (const layer of doc.layers) {
      const v = layerVersion[layer.id] ?? 0
      if (this.layerBaked.get(layer.id) !== v) {
        this.bakeLayer(layer.id, doc)
        this.layerBaked.set(layer.id, v)
      }
    }
    // drop textures for removed layers
    const alive = new Set(doc.layers.map((l) => l.id))
    for (const id of [...this.layers.keys()]) {
      if (!alive.has(id)) {
        this.glc.deleteTarget(this.layers.get(id)!)
        this.layers.delete(id)
        this.layerBaked.delete(id)
      }
    }
  }

  // --- live stroke ---
  beginStroke(live: LiveStroke): void {
    const brush = getBrush(live.brushId)
    this.liveState = {
      live,
      brush,
      stamper: new StrokeStamper(brush, live.size),
      rgb: hexToRgb(live.color),
    }
    if (this.scratch) this.clearTarget(this.scratch, 0, 0, 0, 0)
  }

  extendStroke(points: Parameters<PaintEngine['extendStroke']>[0]): void {
    const ls = this.liveState
    if (!ls || !this.scratch) return
    const dabs = ls.stamper.addPoints(points)
    this.drawDabs(dabs, ls.brush, ls.rgb)
  }

  commitStroke(): void {
    // The store already added the element and bumped the layer version. Bake the
    // scratch directly and mark this layer's version as current (no full replay).
    const ls = this.liveState
    this.liveState = null
    if (!ls) return
    const target = this.layerTarget(ls.live.layerId)
    this.applyStrokeToLayer(target, {
      opacity: ls.live.opacity,
      erase: ls.brush.erase,
      mode: ls.brush.composite === 'multiply' ? 1 : 0,
      alphaLock: ls.live.alphaLock,
    })
  }

  cancelStroke(): void {
    this.liveState = null
    if (this.scratch) this.clearTarget(this.scratch, 0, 0, 0, 0)
  }

  /** doc -> clip matrix (column-major), including camera and screen y-flip. */
  private cameraMatrix(cam: Camera, cssW: number, cssH: number): Float32Array {
    const s = cam.zoom
    const cos = Math.cos(cam.rotation)
    const sin = Math.sin(cam.rotation)
    const a = s * cos
    const b = s * sin
    const c = -s * sin
    const d = s * cos
    const e = -s * cos * cam.x + s * sin * cam.y
    const f = -s * sin * cam.x - s * cos * cam.y
    const A = (2 * a) / cssW
    const C = (2 * c) / cssW
    const E = (2 * e) / cssW - 1
    const B = (-2 * b) / cssH
    const D = (-2 * d) / cssH
    const F = (-2 * f) / cssH + 1
    // column-major mat3
    return new Float32Array([A, B, 0, C, D, 0, E, F, 1])
  }

  private composite(doc: SketchDocument): GLTarget {
    const gl = this.gl
    const bg = hexToRgb(doc.background)
    let src = this.accumA!
    let dst = this.accumB!
    // background
    this.clearTarget(src, bg[0], bg[1], bg[2], 1)

    // Build merged active layer (committed + live scratch) if a stroke is live.
    let mergedActiveId: string | null = null
    if (this.liveState) {
      const ls = this.liveState
      mergedActiveId = ls.live.layerId
      this.strokeIntoWork(this.layerTarget(ls.live.layerId), ls.live.opacity,
        ls.brush.composite === 'multiply' ? 1 : 0, ls.brush.erase, ls.live.alphaLock)
    }

    const ordered = [...doc.layers].sort((x, y) => x.order - y.order)
    for (const layer of ordered) {
      if (!layer.visible) continue
      const layerTex =
        mergedActiveId === layer.id ? this.work!.tex : this.layerTarget(layer.id).tex
      this.glc.bindTarget(dst)
      gl.disable(gl.BLEND)
      this.pLayer.use()
      this.bindTex(0, src.tex)
      gl.uniform1i(this.pLayer.loc('uPrev'), 0)
      this.bindTex(1, layerTex)
      gl.uniform1i(this.pLayer.loc('uLayer'), 1)
      gl.uniform1f(this.pLayer.loc('uOpacity'), layer.opacity)
      gl.uniform1i(this.pLayer.loc('uMode'), BLEND_ENUM[layer.blendMode] ?? 0)
      gl.uniform1i(this.pLayer.loc('uClip'), layer.clipped ? 1 : 0)
      this.glc.drawQuad()
      const tmp = src
      src = dst
      dst = tmp
    }
    return src
  }

  render(input: SceneInput): void {
    const { doc, camera, width, height, dpr } = input
    if (!this.glc) return
    this.ensureTargets(doc)
    this.ensureLayers(doc, input.layerVersion)

    const dw = Math.max(1, Math.round(width * dpr))
    const dh = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== dw || this.canvas.height !== dh) {
      this.canvas.width = dw
      this.canvas.height = dh
    }

    const accum = this.composite(doc)

    // draw to screen
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, dw, dh)
    gl.disable(gl.BLEND)
    gl.clearColor(0.07, 0.07, 0.09, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.pScreen.use()
    this.bindTex(0, accum.tex)
    gl.uniform1i(this.pScreen.loc('uAccum'), 0)
    gl.uniformMatrix3fv(this.pScreen.loc('uMatrix'), false, this.cameraMatrix(camera, width, height))
    gl.uniform2f(this.pScreen.loc('uDocSize'), doc.width, doc.height)
    this.glc.drawQuad()
  }

  exportToCanvas(doc: SketchDocument, scale = 1): HTMLCanvasElement {
    this.ensureTargets(doc)
    // Force a full re-bake for a clean, deterministic export.
    this.layerBaked.clear()
    const version: Record<string, number> = {}
    doc.layers.forEach((l) => (version[l.id] = -999)) // guarantee mismatch -> rebake
    this.ensureLayers(doc, version)
    const accum = this.composite(doc)

    const gl = this.gl
    const w = doc.width
    const h = doc.height
    const pixels = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fbo)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const base = document.createElement('canvas')
    base.width = w
    base.height = h
    const ctx = base.getContext('2d')!
    const img = ctx.createImageData(w, h)
    img.data.set(pixels)
    ctx.putImageData(img, 0, 0)

    if (scale === 1) return base
    const out = document.createElement('canvas')
    out.width = Math.round(w * scale)
    out.height = Math.round(h * scale)
    const octx = out.getContext('2d')!
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(base, 0, 0, out.width, out.height)
    return out
  }
}

export function isWebGL2Available(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}
