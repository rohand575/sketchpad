import type { Camera, SketchDocument, StrokePoint } from '@/model/types'

/** A stroke currently being drawn (not yet committed to the document). */
export interface LiveStroke {
  layerId: string
  brushId: string
  color: string
  size: number
  opacity: number
  /** Restrict painting to existing pixels of the layer (alpha lock). */
  alphaLock: boolean
  points: StrokePoint[]
}

/** Everything the engine needs to composite a frame. */
export interface SceneInput {
  doc: SketchDocument
  camera: Camera
  /** CSS pixel size of the canvas. */
  width: number
  height: number
  dpr: number
  /** Per-layer content version; a change forces that layer to re-bake. */
  layerVersion: Record<string, number>
}

/**
 * Painting backend contract. The engine owns the live stroke (so it can render
 * textured dabs into a scratch buffer). v1 ships a WebGL2 engine with a Canvas2D
 * fallback. Selection/marquee overlays are drawn separately (2D overlay canvas).
 */
export interface PaintEngine {
  attach(canvas: HTMLCanvasElement): void
  render(input: SceneInput): void
  beginStroke(live: LiveStroke): void
  extendStroke(points: StrokePoint[]): void
  /** Bake the finished live stroke; the caller must have added it to the store first. */
  commitStroke(): void
  cancelStroke(): void
  /** Rasterize the whole document to a canvas for export (`scale` multiplies doc size). */
  exportToCanvas(doc: SketchDocument, scale: number): HTMLCanvasElement
  dispose(): void
}
