import type { Bounds, BrushType, Camera, SketchDocument, StrokePoint } from '@/model/types'

/** Screen-space (CSS px) rectangle for the box-select marquee. */
export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

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
  /** World-space bounds of the current selection (draws box + handles). */
  selectionBounds: Bounds | null
  /** In-progress box-select marquee (screen CSS px). */
  marquee: ScreenRect | null
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
