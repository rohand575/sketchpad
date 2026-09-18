// Core data model for a Sketchpad document.
// Everything is stored as vector data in *world* coordinates. The camera maps
// world -> screen at render time, giving an infinite, resolution-independent canvas.

export type BrushType = 'pen' | 'pencil' | 'marker' | 'eraser'

/** A single sampled input point in world space. `p` is normalized pressure 0..1. */
export interface StrokePoint {
  x: number
  y: number
  p: number
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
  brush: BrushType
  /** CSS color string (ignored for eraser). */
  color: string
  /** Base brush diameter in world units. */
  size: number
  /** 0..1 */
  opacity: number
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
  /** Reference to a blob stored locally / in cloud storage. */
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
  camera: Camera
  layers: Layer[]
  elements: Element[]
  /** Schema version for forward-compatible migrations. */
  version: number
}

export const DOCUMENT_VERSION = 1
