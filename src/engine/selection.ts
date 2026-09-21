import type { Bounds, Camera, Element, StrokeElement } from '@/model/types'
import { boundsFromPoints } from '@/model/factory'
import { worldToScreen, type Point } from './camera'

// --- 2D affine matrix [a, b, c, d, e, f]: (x,y) -> (a x + c y + e, b x + d y + f) ---
export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function multiply(m1: Matrix, m2: Matrix): Matrix {
  // returns m1 * m2 (apply m2 first, then m1)
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

export function translation(dx: number, dy: number): Matrix {
  return [1, 0, 0, 1, dx, dy]
}

export function scaleAbout(s: number, o: Point): Matrix {
  // translate(o) * scale(s) * translate(-o)
  return [s, 0, 0, s, o.x - s * o.x, o.y - s * o.y]
}

export function rotateAbout(angle: number, o: Point): Matrix {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    cos,
    sin,
    -sin,
    cos,
    o.x - cos * o.x + sin * o.y,
    o.y - sin * o.x - cos * o.y,
  ]
}

function applyPoint(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }
}

/** Average scale factor of a matrix (for scaling brush width uniformly). */
function matrixScale(m: Matrix): number {
  const det = m[0] * m[3] - m[1] * m[2]
  return Math.sqrt(Math.abs(det)) || 1
}

/** Return a transformed copy of an element (v1: strokes; others passthrough). */
export function applyMatrixToElement(el: Element, m: Matrix): Element {
  if (el.type !== 'stroke') return el
  const s = matrixScale(m)
  const points = el.points.map((p) => {
    const t = applyPoint(m, p.x, p.y)
    return { x: t.x, y: t.y, p: p.p }
  })
  const size = el.size * s
  const next: StrokeElement = {
    ...el,
    points,
    size,
    bbox: boundsFromPoints(points, size),
  }
  return next
}

// --- bounds helpers ---
export function boundsOfElements(elements: Element[]): Bounds | null {
  if (elements.length === 0) return null
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const el of elements) {
    b.minX = Math.min(b.minX, el.bbox.minX)
    b.minY = Math.min(b.minY, el.bbox.minY)
    b.maxX = Math.max(b.maxX, el.bbox.maxX)
    b.maxY = Math.max(b.maxY, el.bbox.maxY)
  }
  return b
}

export function boundsCenter(b: Bounds): Point {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
}

function pointInBounds(b: Bounds, x: number, y: number, pad = 0): boolean {
  return x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

/** Distance from a point to a line segment. */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** True when a world point is close enough to a stroke to count as a hit. */
function pointNearStroke(el: StrokeElement, x: number, y: number, tol: number): boolean {
  const reach = el.size / 2 + tol
  const pts = el.points
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) <= reach
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= reach) return true
  }
  return false
}

/** Topmost element hit by a world point (last drawn wins). */
export function hitTest(elements: Element[], x: number, y: number, tol: number): string | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!pointInBounds(el.bbox, x, y, tol)) continue
    if (el.type === 'stroke') {
      if (pointNearStroke(el, x, y, tol)) return el.id
    } else {
      return el.id
    }
  }
  return null
}

/** Ids of elements whose bounds intersect a world-space rectangle. */
export function elementsInRect(elements: Element[], rect: Bounds): string[] {
  return elements.filter((el) => boundsIntersect(el.bbox, rect)).map((el) => el.id)
}

// --- transform handles (screen space, CSS px) ---
export type HandleKind = 'nw' | 'ne' | 'se' | 'sw' | 'rotate' | 'body'

export interface HandleLayout {
  /** Screen positions of the four scale corners. */
  corners: Record<'nw' | 'ne' | 'se' | 'sw', Point>
  /** Screen position of the rotate handle. */
  rotate: Point
  /** Screen anchor for the rotate line (top-center). */
  rotateAnchor: Point
  /** World corners, for scaling anchors. */
  worldCorners: Record<'nw' | 'ne' | 'se' | 'sw', Point>
}

export const ROTATE_OFFSET_PX = 34

export function handleLayout(b: Bounds, cam: Camera): HandleLayout {
  const worldCorners = {
    nw: { x: b.minX, y: b.minY },
    ne: { x: b.maxX, y: b.minY },
    se: { x: b.maxX, y: b.maxY },
    sw: { x: b.minX, y: b.maxY },
  }
  const corners = {
    nw: worldToScreen(cam, worldCorners.nw.x, worldCorners.nw.y),
    ne: worldToScreen(cam, worldCorners.ne.x, worldCorners.ne.y),
    se: worldToScreen(cam, worldCorners.se.x, worldCorners.se.y),
    sw: worldToScreen(cam, worldCorners.sw.x, worldCorners.sw.y),
  }
  const topCenter = { x: (corners.nw.x + corners.ne.x) / 2, y: (corners.nw.y + corners.ne.y) / 2 }
  // Push the rotate handle "up" along the box's local up-vector (nw->sw reversed).
  const up = { x: corners.nw.x - corners.sw.x, y: corners.nw.y - corners.sw.y }
  const upLen = Math.hypot(up.x, up.y) || 1
  const rotate = {
    x: topCenter.x + (up.x / upLen) * ROTATE_OFFSET_PX,
    y: topCenter.y + (up.y / upLen) * ROTATE_OFFSET_PX,
  }
  return { corners, rotate, rotateAnchor: topCenter, worldCorners }
}

/** Which handle (if any) a screen point is over. */
export function hitHandle(
  layout: HandleLayout,
  screen: Point,
  radius = 14,
): Exclude<HandleKind, 'body'> | null {
  const check = (p: Point) => Math.hypot(p.x - screen.x, p.y - screen.y) <= radius
  if (check(layout.rotate)) return 'rotate'
  const order: ('nw' | 'ne' | 'se' | 'sw')[] = ['nw', 'ne', 'se', 'sw']
  for (const k of order) if (check(layout.corners[k])) return k
  return null
}

export function oppositeCorner(k: 'nw' | 'ne' | 'se' | 'sw'): 'nw' | 'ne' | 'se' | 'sw' {
  return ({ nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' } as const)[k]
}
