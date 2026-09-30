import type { BlendMode, Camera, SketchDocument, StrokeElement, StrokePoint } from '@/model/types'
import { getBrush } from '@/engine/brushes/library'
import { outlineToPath, strokeOutline } from '@/engine/brushes/stroke'
import type { LiveStroke, PaintEngine, SceneInput } from './types'

// Canvas2D fallback engine (used when WebGL2 is unavailable). It renders strokes
// as flat variable-width fills — no texture/grain — but supports layers, layer
// opacity, blend modes (via globalCompositeOperation), and erasing.

const BLEND_TO_COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  add: 'lighter',
  'soft-light': 'soft-light',
}

function applyCameraTransform(ctx: CanvasRenderingContext2D, c: Camera, dpr: number): void {
  const s = c.zoom
  const cos = Math.cos(c.rotation)
  const sin = Math.sin(c.rotation)
  const a = s * cos
  const b = s * sin
  const cc = -s * sin
  const d = s * cos
  const e = -s * cos * c.x + s * sin * c.y
  const f = -s * sin * c.x - s * cos * c.y
  ctx.setTransform(dpr * a, dpr * b, dpr * cc, dpr * d, dpr * e, dpr * f)
}

export class Canvas2DRenderer implements PaintEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private layerCanvas = document.createElement('canvas')
  private layerCtx = this.layerCanvas.getContext('2d')!
  private live: LiveStroke | null = null

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })!
  }

  dispose(): void {
    this.canvas = null
    this.ctx = null
  }

  beginStroke(live: LiveStroke): void {
    this.live = live
  }
  extendStroke(points: StrokePoint[]): void {
    if (this.live) this.live.points.push(...points)
  }
  commitStroke(): void {
    this.live = null
  }
  cancelStroke(): void {
    this.live = null
  }

  private paintStroke(
    ctx: CanvasRenderingContext2D,
    points: StrokePoint[],
    size: number,
    color: string,
    opacity: number,
    erase: boolean,
    marker: boolean,
  ): void {
    if (points.length === 0) return
    const path = outlineToPath(strokeOutline(points, size))
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.globalCompositeOperation = erase ? 'destination-out' : marker ? 'multiply' : 'source-over'
    ctx.fillStyle = erase ? '#000' : color
    ctx.fill(path)
    ctx.restore()
  }

  render(input: SceneInput): void {
    const { doc, camera, width, height, dpr } = input
    if (!this.canvas || !this.ctx) return
    const dw = Math.max(1, Math.round(width * dpr))
    const dh = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== dw || this.canvas.height !== dh) {
      this.canvas.width = dw
      this.canvas.height = dh
    }
    if (this.layerCanvas.width !== dw || this.layerCanvas.height !== dh) {
      this.layerCanvas.width = dw
      this.layerCanvas.height = dh
    }

    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, dw, dh)
    ctx.fillStyle = '#121218'
    ctx.fillRect(0, 0, dw, dh)

    // Document background rectangle.
    applyCameraTransform(ctx, camera, dpr)
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, doc.width, doc.height)

    const layers = [...doc.layers].sort((a, b) => a.order - b.order)
    for (const layer of layers) {
      if (!layer.visible) continue
      const lctx = this.layerCtx
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.clearRect(0, 0, dw, dh)
      applyCameraTransform(lctx, camera, dpr)

      for (const el of doc.elements) {
        if (el.layerId !== layer.id || el.type !== 'stroke') continue
        const s = el as StrokeElement
        const brush = getBrush(s.brushId)
        this.paintStroke(lctx, s.points, s.size, s.color, s.opacity, brush.erase, brush.composite === 'multiply')
      }
      if (this.live && this.live.layerId === layer.id && this.live.points.length) {
        const brush = getBrush(this.live.brushId)
        this.paintStroke(
          lctx,
          this.live.points,
          this.live.size,
          this.live.color,
          this.live.opacity,
          brush.erase,
          brush.composite === 'multiply',
        )
      }

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.blendMode] ?? 'source-over'
      ctx.drawImage(this.layerCanvas, 0, 0)
      ctx.restore()
    }
  }

  exportToCanvas(doc: SketchDocument, scale = 1): HTMLCanvasElement {
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(doc.width * scale))
    out.height = Math.max(1, Math.round(doc.height * scale))
    const ctx = out.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, doc.width, doc.height)

    const tmp = document.createElement('canvas')
    tmp.width = doc.width
    tmp.height = doc.height
    const tctx = tmp.getContext('2d')!

    const layers = [...doc.layers].sort((a, b) => a.order - b.order)
    for (const layer of layers) {
      if (!layer.visible) continue
      tctx.setTransform(1, 0, 0, 1, 0, 0)
      tctx.clearRect(0, 0, doc.width, doc.height)
      for (const el of doc.elements) {
        if (el.layerId !== layer.id || el.type !== 'stroke') continue
        const s = el as StrokeElement
        const brush = getBrush(s.brushId)
        this.paintStroke(tctx, s.points, s.size, s.color, s.opacity, brush.erase, brush.composite === 'multiply')
      }
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.blendMode] ?? 'source-over'
      ctx.drawImage(tmp, 0, 0)
      ctx.restore()
    }
    return out
  }
}
