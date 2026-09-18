import { getStroke } from 'perfect-freehand'
import type { BrushType, StrokeElement, StrokePoint } from '@/model/types'
import { BRUSH_PRESETS } from './presets'

/** True when the samples carry meaningful pressure variation (i.e. a real stylus). */
function hasRealPressure(points: StrokePoint[]): boolean {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.p < min) min = p.p
    if (p.p > max) max = p.p
  }
  return max - min > 0.01
}

function buildOutline(points: StrokePoint[], brush: BrushType, size: number): number[][] {
  const preset = BRUSH_PRESETS[brush]
  // Use real stylus pressure when present; otherwise let perfect-freehand
  // simulate pressure from velocity (nice tapering for mouse/trackpad).
  const simulatePressure = hasRealPressure(points)
    ? false
    : (preset.freehand.simulatePressure ?? true)
  const input = points.map((p) => [p.x, p.y, p.p] as [number, number, number])
  return getStroke(input, { size, ...preset.freehand, simulatePressure })
}

/** Outline polygon for a committed stroke element (world coordinates). */
export function strokeOutline(el: StrokeElement): number[][] {
  return buildOutline(el.points, el.brush, el.size)
}

/** Outline polygon for an in-progress stroke. */
export function liveOutline(
  points: StrokePoint[],
  brush: BrushType,
  size: number,
): number[][] {
  return buildOutline(points, brush, size)
}

/** Build a Path2D from an outline polygon using quadratic smoothing. */
export function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D()
  if (outline.length < 2) return path
  const [first] = outline
  path.moveTo(first[0], first[1])
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    const midX = (a[0] + b[0]) / 2
    const midY = (a[1] + b[1]) / 2
    path.quadraticCurveTo(a[0], a[1], midX, midY)
  }
  path.closePath()
  return path
}
