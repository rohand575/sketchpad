import { getStroke } from 'perfect-freehand'
import type { StrokePoint } from '@/model/types'

/** True when the samples carry meaningful pressure variation (a real stylus). */
function hasRealPressure(points: StrokePoint[]): boolean {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.p < min) min = p.p
    if (p.p > max) max = p.p
  }
  return max - min > 0.01
}

/**
 * Variable-width outline for a stroke. Used by the Canvas2D fallback engine only
 * (the WebGL engine stamps textured dabs instead).
 */
export function strokeOutline(points: StrokePoint[], size: number): number[][] {
  const simulatePressure = !hasRealPressure(points)
  const input = points.map((p) => [p.x, p.y, p.p] as [number, number, number])
  return getStroke(input, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure,
  })
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
