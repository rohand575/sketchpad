import { nanoid } from 'nanoid'
import {
  DOCUMENT_VERSION,
  type Bounds,
  type Camera,
  type Layer,
  type SketchDocument,
  type StrokeElement,
  type StrokePoint,
} from './types'

export const EMPTY_BOUNDS: Bounds = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
}

/** Fixed-canvas size presets offered when creating a document. */
export interface CanvasPreset {
  id: string
  label: string
  width: number
  height: number
  dpi: number
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'screen', label: 'Screen', width: 1920, height: 1080, dpi: 132 },
  { id: 'square', label: 'Square 3000', width: 3000, height: 3000, dpi: 132 },
  { id: 'a4', label: 'A4 Print', width: 2480, height: 3508, dpi: 300 },
  { id: 'portrait', label: 'Portrait HD', width: 1080, height: 1920, dpi: 132 },
  { id: '4k', label: '4K', width: 3840, height: 2160, dpi: 160 },
]

export const DEFAULT_PRESET = CANVAS_PRESETS[1]

// Keep textures within common GPU limits.
export const MAX_CANVAS_DIM = 4096

export function createId(prefix = ''): string {
  return prefix ? `${prefix}_${nanoid(10)}` : nanoid(12)
}

export function defaultCamera(): Camera {
  return { x: 0, y: 0, zoom: 1, rotation: 0 }
}

export function createLayer(order: number, name?: string): Layer {
  return {
    id: createId('layer'),
    name: name ?? `Layer ${order + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    order,
    blendMode: 'normal',
    clipped: false,
    alphaLock: false,
  }
}

export interface CreateDocumentOptions {
  title?: string
  width?: number
  height?: number
  dpi?: number
  now?: number
}

export function createDocument(options: CreateDocumentOptions = {}): SketchDocument {
  const now = options.now ?? Date.now()
  const layer = createLayer(0, 'Layer 1')
  return {
    id: createId('doc'),
    title: options.title ?? 'Untitled',
    createdAt: now,
    updatedAt: now,
    background: '#ffffff',
    width: Math.min(MAX_CANVAS_DIM, options.width ?? DEFAULT_PRESET.width),
    height: Math.min(MAX_CANVAS_DIM, options.height ?? DEFAULT_PRESET.height),
    dpi: options.dpi ?? DEFAULT_PRESET.dpi,
    camera: defaultCamera(),
    layers: [layer],
    elements: [],
    version: DOCUMENT_VERSION,
  }
}

/** Compute the world-space bounds of a set of stroke points, padded by the brush radius. */
export function boundsFromPoints(points: StrokePoint[], padding: number): Bounds {
  const b: Bounds = { ...EMPTY_BOUNDS }
  for (const pt of points) {
    if (pt.x < b.minX) b.minX = pt.x
    if (pt.y < b.minY) b.minY = pt.y
    if (pt.x > b.maxX) b.maxX = pt.x
    if (pt.y > b.maxY) b.maxY = pt.y
  }
  if (!Number.isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return {
    minX: b.minX - padding,
    minY: b.minY - padding,
    maxX: b.maxX + padding,
    maxY: b.maxY + padding,
  }
}

export interface CreateStrokeArgs {
  layerId: string
  brushId: string
  color: string
  size: number
  opacity: number
  alphaLock?: boolean
  points: StrokePoint[]
}

export function createStroke(args: CreateStrokeArgs): StrokeElement {
  return {
    id: createId('el'),
    type: 'stroke',
    layerId: args.layerId,
    brushId: args.brushId,
    color: args.color,
    size: args.size,
    opacity: args.opacity,
    alphaLock: args.alphaLock,
    points: args.points,
    bbox: boundsFromPoints(args.points, args.size),
  }
}

// Map legacy (v1) brush categories to the new brush library ids.
const LEGACY_BRUSH_MAP: Record<string, string> = {
  pen: 'studio-pen',
  pencil: 'technical-pencil',
  marker: 'marker',
  eraser: 'eraser-hard',
}

/**
 * Upgrade an older document to the current schema. Idempotent: a current-version
 * doc is returned unchanged.
 */
export function migrateDocument(raw: SketchDocument): SketchDocument {
  if (raw.version >= DOCUMENT_VERSION && raw.width && raw.height) return raw

  const doc = { ...raw } as SketchDocument & { elements: unknown[] }

  // Layers gain blend/clip/alpha-lock fields.
  doc.layers = (raw.layers ?? []).map((l) => ({
    ...l,
    blendMode: (l as Layer).blendMode ?? 'normal',
    clipped: (l as Layer).clipped ?? false,
    alphaLock: (l as Layer).alphaLock ?? false,
  }))

  // Elements: map legacy `brush` -> `brushId`.
  doc.elements = (raw.elements ?? []).map((el) => {
    const e = el as StrokeElement & { brush?: string }
    if (e.type === 'stroke' && !e.brushId) {
      const brushId = LEGACY_BRUSH_MAP[e.brush ?? 'pen'] ?? 'studio-pen'
      const { brush: _drop, ...rest } = e
      return { ...rest, brushId }
    }
    return el
  }) as SketchDocument['elements']

  // Fixed canvas size: fit legacy content, else default.
  if (!doc.width || !doc.height) {
    let maxX = 0
    let maxY = 0
    for (const el of doc.elements) {
      maxX = Math.max(maxX, el.bbox?.maxX ?? 0)
      maxY = Math.max(maxY, el.bbox?.maxY ?? 0)
    }
    doc.width = Math.min(MAX_CANVAS_DIM, Math.max(DEFAULT_PRESET.width, Math.ceil(maxX)))
    doc.height = Math.min(MAX_CANVAS_DIM, Math.max(DEFAULT_PRESET.height, Math.ceil(maxY)))
  }
  doc.dpi = doc.dpi ?? DEFAULT_PRESET.dpi
  doc.background = doc.background ?? '#ffffff'
  doc.camera = doc.camera ?? defaultCamera()
  doc.version = DOCUMENT_VERSION
  return doc
}
