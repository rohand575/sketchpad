// Core data model for a Sketchpad document.
//
// Documents are a *fixed-size* pixel canvas (like Procreate). Strokes are stored
// as replayable vector commands in document/world coordinates (0,0)..(width,height);
// the WebGL engine replays them into per-layer raster textures. Keeping strokes as
// commands (not bitmaps) keeps cloud sync cheap and exports resolution-independent.

/** Legacy brush categories (v1). Retained for migration to brush ids. */
export type BrushType = 'pen' | 'pencil' | 'marker' | 'eraser'

/** Layer compositing modes (subset implemented in the composite shader). */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'add'
  | 'soft-light'

/** A single sampled input point in document space. `p` is normalized pressure 0..1. */
export interface StrokePoint {
  x: number
  y: number
  p: number
  /** Stylus tilt in degrees along each axis (optional; -90..90). */
  tx?: number
  ty?: number
}

/** Axis-aligned bounding box in world space; cached for hit-testing & dirty regions. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ElementBase {
  id: string
  layerId: string
  /** Cached world-space bounds. Recomputed whenever geometry changes. */
  bbox: Bounds
}

export interface StrokeElement extends ElementBase {
  type: 'stroke'
  /** Brush definition id (see engine/brushes/library.ts). */
  brushId: string
  /** CSS color string (ignored for eraser brushes). */
  color: string
  /** Base brush diameter in document units. */
  size: number
  /** 0..1 brush opacity (applied once per whole stroke). */
  opacity: number
  /** Whether alpha-lock was active when painted (persisted for faithful replay). */
  alphaLock?: boolean
  points: StrokePoint[]
}

// --- Scaffolded element types (rendered later; present so the model is stable). ---
export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: 'rectangle' | 'ellipse' | 'line' | 'arrow'
  color: string
  size: number
  opacity: number
  from: { x: number; y: number }
  to: { x: number; y: number }
  fill?: string
}

export interface TextElement extends ElementBase {
  type: 'text'
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

export interface ImageElement extends ElementBase {
  type: 'image'
  x: number
  y: number
  width: number
  height: number
  src: string
}

export type Element = StrokeElement | ShapeElement | TextElement | ImageElement

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  /** 0..1 layer opacity. */
  opacity: number
  /** Draw order; lower renders first (below). */
  order: number
  blendMode: BlendMode
  /** Clip this layer's paint to the alpha of the content below it. */
  clipped: boolean
  /** Restrict painting to already-painted pixels of this layer. */
  alphaLock: boolean
}

export interface Camera {
  /** World coordinate at the screen origin (top-left), before zoom. */
  x: number
  y: number
  zoom: number
  /** Radians. */
  rotation: number
}

export interface SketchDocument {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** Firebase uid once cloud sync is enabled; undefined while local-only. */
  ownerId?: string
  background: string
  /** Fixed canvas size in pixels. */
  width: number
  height: number
  /** Dots per inch (for print/export sizing). */
  dpi: number
  camera: Camera
  layers: Layer[]
  elements: Element[]
  /** Schema version for forward-compatible migrations. */
  version: number
}

export const DOCUMENT_VERSION = 2
