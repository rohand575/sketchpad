// Data-driven brush definitions for the WebGL stamp engine. A brush is a
// stamp *shape* (alpha mask) optionally modulated by a *grain* texture, plus
// spacing and pressure/velocity dynamics. Textures are generated procedurally
// by the GL engine from the `shape`/`grain` kinds (no binary assets).

export type ShapeKind = 'soft' | 'hard' | 'chalk'
export type GrainKind = 'pencil' | 'canvas' | 'paper' | null
export type BrushCategory = 'ink' | 'pencil' | 'paint' | 'airbrush' | 'marker' | 'eraser'

export interface BrushDynamics {
  /** Size at pressure 0, as a fraction of the nominal size (0..1). */
  minSize: number
  /** Flow at pressure 0, as a fraction of base flow (0..1). */
  minFlow: number
  /** How strongly pressure drives size (0 = none, 1 = full). */
  pressureSize: number
  /** How strongly pressure drives flow. */
  pressureFlow: number
  /** Extra thinning at speed (0 = none). */
  velocitySize: number
}

export interface Brush {
  id: string
  name: string
  category: BrushCategory
  shape: ShapeKind
  grain: GrainKind
  /** Grain texels per document pixel (grain is anchored to the canvas). */
  grainScale: number
  /** Distance between dabs as a fraction of diameter (smaller = smoother/denser). */
  spacing: number
  /** Base per-dab flow 0..1 (opacity contribution of each dab). */
  flow: number
  /** Default whole-stroke opacity 0..1. */
  opacity: number
  /** Default diameter in document px. */
  size: number
  minSize: number
  maxSize: number
  /** Positional jitter as a fraction of diameter. */
  jitter: number
  /** How the finished stroke composites onto the layer. */
  composite: 'normal' | 'multiply'
  /** Eraser brushes remove pixels from the layer. */
  erase: boolean
  dynamics: BrushDynamics
}

const D = (over: Partial<BrushDynamics> = {}): BrushDynamics => ({
  minSize: 0.25,
  minFlow: 0.4,
  pressureSize: 0.7,
  pressureFlow: 0.4,
  velocitySize: 0,
  ...over,
})

export const BRUSHES: Brush[] = [
  {
    id: 'studio-pen',
    name: 'Studio Pen',
    category: 'ink',
    shape: 'hard',
    grain: null,
    grainScale: 1,
    spacing: 0.04,
    flow: 1,
    opacity: 1,
    size: 8,
    minSize: 1,
    maxSize: 120,
    jitter: 0,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.35, minFlow: 0.9, pressureSize: 0.6, pressureFlow: 0.1, velocitySize: 0.25 }),
  },
  {
    id: 'technical-pencil',
    name: 'Technical Pencil',
    category: 'pencil',
    shape: 'hard',
    grain: 'pencil',
    grainScale: 1,
    spacing: 0.07,
    flow: 0.9,
    opacity: 0.9,
    size: 5,
    minSize: 1,
    maxSize: 40,
    jitter: 0.05,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.3, minFlow: 0.5, pressureSize: 0.7, pressureFlow: 0.6 }),
  },
  {
    id: 'pencil-6b',
    name: '6B Pencil',
    category: 'pencil',
    shape: 'chalk',
    grain: 'paper',
    grainScale: 0.8,
    spacing: 0.06,
    flow: 0.7,
    opacity: 0.85,
    size: 12,
    minSize: 2,
    maxSize: 80,
    jitter: 0.08,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.4, minFlow: 0.35, pressureSize: 0.6, pressureFlow: 0.7 }),
  },
  {
    id: 'soft-airbrush',
    name: 'Soft Airbrush',
    category: 'airbrush',
    shape: 'soft',
    grain: null,
    grainScale: 1,
    spacing: 0.03,
    flow: 0.06,
    opacity: 1,
    size: 45,
    minSize: 4,
    maxSize: 300,
    jitter: 0,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.8, minFlow: 0.2, pressureSize: 0.2, pressureFlow: 0.8 }),
  },
  {
    id: 'marker',
    name: 'Marker',
    category: 'marker',
    shape: 'hard',
    grain: null,
    grainScale: 1,
    spacing: 0.03,
    flow: 1,
    opacity: 0.5,
    size: 24,
    minSize: 4,
    maxSize: 140,
    jitter: 0,
    composite: 'multiply',
    erase: false,
    dynamics: D({ minSize: 0.9, minFlow: 1, pressureSize: 0.1, pressureFlow: 0 }),
  },
  {
    id: 'round-paint',
    name: 'Round Paint',
    category: 'paint',
    shape: 'soft',
    grain: 'canvas',
    grainScale: 0.7,
    spacing: 0.06,
    flow: 0.9,
    opacity: 1,
    size: 26,
    minSize: 3,
    maxSize: 200,
    jitter: 0.03,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.5, minFlow: 0.6, pressureSize: 0.6, pressureFlow: 0.5 }),
  },
  {
    id: 'flat-paint',
    name: 'Flat Paint',
    category: 'paint',
    shape: 'chalk',
    grain: 'canvas',
    grainScale: 0.6,
    spacing: 0.09,
    flow: 1,
    opacity: 1,
    size: 32,
    minSize: 4,
    maxSize: 240,
    jitter: 0.04,
    composite: 'normal',
    erase: false,
    dynamics: D({ minSize: 0.5, minFlow: 0.7, pressureSize: 0.6, pressureFlow: 0.4 }),
  },
  {
    id: 'eraser-hard',
    name: 'Eraser',
    category: 'eraser',
    shape: 'hard',
    grain: null,
    grainScale: 1,
    spacing: 0.04,
    flow: 1,
    opacity: 1,
    size: 24,
    minSize: 2,
    maxSize: 300,
    jitter: 0,
    composite: 'normal',
    erase: true,
    dynamics: D({ minSize: 0.6, minFlow: 1, pressureSize: 0.4, pressureFlow: 0 }),
  },
  {
    id: 'eraser-soft',
    name: 'Soft Eraser',
    category: 'eraser',
    shape: 'soft',
    grain: null,
    grainScale: 1,
    spacing: 0.03,
    flow: 0.5,
    opacity: 1,
    size: 40,
    minSize: 4,
    maxSize: 300,
    jitter: 0,
    composite: 'normal',
    erase: true,
    dynamics: D({ minSize: 0.8, minFlow: 0.3, pressureSize: 0.2, pressureFlow: 0.6 }),
  },
]

const BRUSH_BY_ID = new Map(BRUSHES.map((b) => [b.id, b]))

export const DEFAULT_BRUSH_ID = 'studio-pen'

export function getBrush(id: string): Brush {
  return BRUSH_BY_ID.get(id) ?? BRUSH_BY_ID.get(DEFAULT_BRUSH_ID)!
}

/** Brushes grouped by category, for the brush panel UI. */
export function brushesByCategory(): { category: BrushCategory; brushes: Brush[] }[] {
  const order: BrushCategory[] = ['ink', 'pencil', 'paint', 'airbrush', 'marker', 'eraser']
  return order.map((category) => ({
    category,
    brushes: BRUSHES.filter((b) => b.category === category),
  }))
}
