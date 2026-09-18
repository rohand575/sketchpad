import { nanoid } from 'nanoid'
import {
  DOCUMENT_VERSION,
  type Bounds,
  type Camera,
  type Layer,
  type SketchDocument,
  type StrokeElement,
  type StrokePoint,
  type BrushType,
} from './types'

export const EMPTY_BOUNDS: Bounds = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
}

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
  }
}

export function createDocument(title = 'Untitled', now = Date.now()): SketchDocument {
  const layer = createLayer(0, 'Layer 1')
  return {
    id: createId('doc'),
    title,
    createdAt: now,
    updatedAt: now,
    background: '#ffffff',
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
  brush: BrushType
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
}

export function createStroke(args: CreateStrokeArgs): StrokeElement {
  return {
    id: createId('el'),
    type: 'stroke',
    layerId: args.layerId,
    brush: args.brush,
    color: args.color,
    size: args.size,
    opacity: args.opacity,
    points: args.points,
    bbox: boundsFromPoints(args.points, args.size),
  }
}
