import type { Camera, Layer, SketchDocument, StrokeElement } from '@/model/types'
import { BRUSH_PRESETS } from '@/engine/brushes/presets'
import { liveOutline, outlineToPath, strokeOutline } from '@/engine/brushes/stroke'
import { boundsFromPoints } from '@/model/factory'
import { handleLayout } from '@/engine/selection'
import type { IRenderer, LiveStroke, RenderInput } from './types'

const ACCENT = '#7c5cff'

interface LayerCache {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  version: number
  cameraKey: string
  sizeKey: string
}

function cameraKey(c: Camera): string {
  return `${c.x.toFixed(3)},${c.y.toFixed(3)},${c.zoom.toFixed(4)},${c.rotation.toFixed(4)}`
}

/** Canvas transform matrix that maps world coordinates -> device pixels. */
function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  c: Camera,
  dpr: number,
): void {
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

export class Canvas2DRenderer implements IRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private layerCaches = new Map<string, LayerCache>()
  /** Path2D cache keyed by element id; rebuilt when the source reference changes. */
  private pathCache = new Map<string, { path: Path2D; ref: StrokeElement }>()

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })!
  }

  dispose(): void {
    this.layerCaches.clear()
    this.pathCache.clear()
    this.canvas = null
    this.ctx = null
  }

  private getPath(el: StrokeElement): Path2D {
    const cached = this.pathCache.get(el.id)
    if (cached && cached.ref === el) return cached.path
    const path = outlineToPath(strokeOutline(el))
    this.pathCache.set(el.id, { path, ref: el })
    return path
  }

  private ensureCache(layer: Layer, wDev: number, hDev: number): LayerCache {
    let cache = this.layerCaches.get(layer.id)
    if (!cache) {
      const c = document.createElement('canvas')
      cache = {
        canvas: c,
        ctx: c.getContext('2d')!,
        version: -1,
        cameraKey: '',
        sizeKey: '',
      }
      this.layerCaches.set(layer.id, cache)
    }
    if (cache.canvas.width !== wDev || cache.canvas.height !== hDev) {
      cache.canvas.width = wDev
      cache.canvas.height = hDev
    }
    return cache
  }

  private paintStroke(
    ctx: CanvasRenderingContext2D,
    path: Path2D,
    el: Pick<StrokeElement, 'brush' | 'color' | 'opacity'>,
  ): void {
    const preset = BRUSH_PRESETS[el.brush]
    ctx.save()
    ctx.globalCompositeOperation = preset.composite
    ctx.globalAlpha = el.opacity
    ctx.fillStyle = el.brush === 'eraser' ? '#000' : el.color
    ctx.fill(path)
    ctx.restore()
  }

  private renderLayerContent(
    cache: LayerCache,
    doc: SketchDocument,
    layer: Layer,
    camera: Camera,
    dpr: number,
    live: LiveStroke | null,
  ): void {
    const { ctx } = cache
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cache.canvas.width, cache.canvas.height)
    applyCameraTransform(ctx, camera, dpr)

    for (const el of doc.elements) {
      if (el.layerId !== layer.id) continue
      if (el.type !== 'stroke') continue // shapes/text/images: future
      this.paintStroke(ctx, this.getPath(el), el)
    }

    // Draw the in-progress stroke into its owning layer so eraser/marker
    // composite correctly against just this layer's pixels.
    if (live && live.layerId === layer.id && live.points.length > 0) {
      const outline = liveOutline(live.points, live.brush, live.size)
      this.paintStroke(ctx, outlineToPath(outline), live)
    }
  }

  render(input: RenderInput): void {
    const { doc, camera, width, height, dpr, layerVersion, live } = input
    if (!this.canvas || !this.ctx) return

    const wDev = Math.max(1, Math.round(width * dpr))
    const hDev = Math.max(1, Math.round(height * dpr))
    if (this.canvas.width !== wDev || this.canvas.height !== hDev) {
      this.canvas.width = wDev
      this.canvas.height = hDev
    }

    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, wDev, hDev)

    // Background fills the whole viewport.
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, wDev, hDev)

    const camKey = cameraKey(camera)
    const sizeKey = `${wDev}x${hDev}`
    const layers = [...doc.layers].sort((a, b) => a.order - b.order)

    for (const layer of layers) {
      if (!layer.visible) continue
      const cache = this.ensureCache(layer, wDev, hDev)
      const hasLive = !!live && live.layerId === layer.id
      const version = layerVersion[layer.id] ?? 0
      const stale =
        cache.version !== version || cache.cameraKey !== camKey || cache.sizeKey !== sizeKey
      if (stale || hasLive) {
        this.renderLayerContent(cache, doc, layer, camera, dpr, live)
        // Don't persist the cache key while a live stroke is baked in.
        cache.version = hasLive ? -1 : version
        cache.cameraKey = hasLive ? '' : camKey
        cache.sizeKey = sizeKey
      }
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(cache.canvas, 0, 0)
      ctx.restore()
    }

    // Drop caches for deleted layers.
    if (this.layerCaches.size > layers.length) {
      const alive = new Set(layers.map((l) => l.id))
      for (const id of [...this.layerCaches.keys()]) {
        if (!alive.has(id)) this.layerCaches.delete(id)
      }
    }

    this.drawOverlay(ctx, input)
  }

  /** Selection box + transform handles + marquee, drawn in CSS pixels. */
  private drawOverlay(ctx: CanvasRenderingContext2D, input: RenderInput): void {
    const { selectionBounds, marquee, camera, dpr } = input
    if (!selectionBounds && !marquee) return
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (marquee) {
      ctx.strokeStyle = ACCENT
      ctx.fillStyle = 'rgba(124, 92, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h)
      ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h)
      ctx.setLineDash([])
    }

    if (selectionBounds) {
      const l = handleLayout(selectionBounds, camera)
      const c = l.corners
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(c.nw.x, c.nw.y)
      ctx.lineTo(c.ne.x, c.ne.y)
      ctx.lineTo(c.se.x, c.se.y)
      ctx.lineTo(c.sw.x, c.sw.y)
      ctx.closePath()
      ctx.stroke()

      // rotate stalk + knob
      ctx.beginPath()
      ctx.moveTo(l.rotateAnchor.x, l.rotateAnchor.y)
      ctx.lineTo(l.rotate.x, l.rotate.y)
      ctx.stroke()
      this.knob(ctx, l.rotate.x, l.rotate.y, 6, true)

      // corner scale handles
      for (const k of ['nw', 'ne', 'se', 'sw'] as const) {
        this.knob(ctx, c[k].x, c[k].y, 5, false)
      }
    }
    ctx.restore()
  }

  private knob(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    round: boolean,
  ): void {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (round) ctx.arc(x, y, r, 0, Math.PI * 2)
    else ctx.rect(x - r, y - r, r * 2, r * 2)
    ctx.fill()
    ctx.stroke()
  }

  exportToCanvas(doc: SketchDocument, scale = 1): HTMLCanvasElement {
    // Fit all elements into a tight bounds (fallback to a default page size).
    let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const el of doc.elements) {
      b.minX = Math.min(b.minX, el.bbox.minX)
      b.minY = Math.min(b.minY, el.bbox.minY)
      b.maxX = Math.max(b.maxX, el.bbox.maxX)
      b.maxY = Math.max(b.maxY, el.bbox.maxY)
    }
    if (!Number.isFinite(b.minX)) b = { minX: 0, minY: 0, maxX: 1280, maxY: 800 }
    const pad = 24
    const worldW = b.maxX - b.minX + pad * 2
    const worldH = b.maxY - b.minY + pad * 2

    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(worldW * scale))
    out.height = Math.max(1, Math.round(worldH * scale))
    const ctx = out.getContext('2d')!
    ctx.fillStyle = doc.background
    ctx.fillRect(0, 0, out.width, out.height)

    const exportCamera: Camera = {
      x: b.minX - pad,
      y: b.minY - pad,
      zoom: 1,
      rotation: 0,
    }

    const layers = [...doc.layers].sort((a, b2) => a.order - b2.order)
    for (const layer of layers) {
      if (!layer.visible) continue
      const tmp = document.createElement('canvas')
      tmp.width = out.width
      tmp.height = out.height
      const tctx = tmp.getContext('2d')!
      applyCameraTransform(tctx, exportCamera, scale)
      for (const el of doc.elements) {
        if (el.layerId !== layer.id || el.type !== 'stroke') continue
        this.paintStroke(tctx, outlineToPath(strokeOutline(el)), el)
      }
      ctx.globalAlpha = layer.opacity
      ctx.drawImage(tmp, 0, 0)
      ctx.globalAlpha = 1
    }
    return out
  }
}

// Re-export a helper used by tools when committing a live stroke.
export { boundsFromPoints }
