import type { BrushType, Camera, SketchDocument, StrokePoint } from '@/model/types'

/** A stroke currently being drawn (not yet committed to the document). */
export interface LiveStroke {
  layerId: string
  brush: BrushType
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
}

export interface RenderInput {
  doc: SketchDocument
  camera: Camera
  /** CSS pixel size of the canvas. */
  width: number
  height: number
  dpr: number
  /** Per-layer content version; a change invalidates that layer's cache. */
  layerVersion: Record<string, number>
  live: LiveStroke | null
}

/**
 * Rendering backend contract. v1 ships Canvas2DRenderer; a WebGL backend (for
 * textured brushes / very large scenes) can implement the same interface later.
 */
export interface IRenderer {
  attach(canvas: HTMLCanvasElement): void
  render(input: RenderInput): void
  /** Rasterize the visible document to an offscreen canvas for export. */
  exportToCanvas(doc: SketchDocument, scale: number): HTMLCanvasElement
  dispose(): void
}
