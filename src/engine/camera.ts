import type { Camera } from '@/model/types'

export interface Point {
  x: number
  y: number
}

// The camera maps world <-> screen. Transform order (world -> screen):
//   translate(-cam.x, -cam.y) -> rotate(cam.rotation) -> scale(cam.zoom)
// We keep the math explicit (rather than relying on ctx state) so hit-testing,
// gestures and the renderer all agree on a single source of truth.

export function worldToScreen(cam: Camera, wx: number, wy: number): Point {
  const dx = wx - cam.x
  const dy = wy - cam.y
  const cos = Math.cos(cam.rotation)
  const sin = Math.sin(cam.rotation)
  const rx = dx * cos - dy * sin
  const ry = dx * sin + dy * cos
  return { x: rx * cam.zoom, y: ry * cam.zoom }
}

export function screenToWorld(cam: Camera, sx: number, sy: number): Point {
  const ix = sx / cam.zoom
  const iy = sy / cam.zoom
  const cos = Math.cos(-cam.rotation)
  const sin = Math.sin(-cam.rotation)
  const rx = ix * cos - iy * sin
  const ry = ix * sin + iy * cos
  return { x: rx + cam.x, y: ry + cam.y }
}

const MIN_ZOOM = 0.05
const MAX_ZOOM = 64

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Zoom while keeping the given screen anchor point fixed over the same world point. */
export function zoomAt(cam: Camera, factor: number, anchor: Point): Camera {
  const nextZoom = clampZoom(cam.zoom * factor)
  const worldAnchor = screenToWorld(cam, anchor.x, anchor.y)
  const next: Camera = { ...cam, zoom: nextZoom }
  // Solve for translation so that worldAnchor maps back to the same screen anchor.
  const afterScreen = worldToScreen(next, worldAnchor.x, worldAnchor.y)
  const cos = Math.cos(-next.rotation)
  const sin = Math.sin(-next.rotation)
  const errX = (afterScreen.x - anchor.x) / nextZoom
  const errY = (afterScreen.y - anchor.y) / nextZoom
  next.x += errX * cos - errY * sin
  next.y += errX * sin + errY * cos
  return next
}

/** Rotate around a screen anchor keeping the underlying world point fixed. */
export function rotateAt(cam: Camera, deltaRadians: number, anchor: Point): Camera {
  const worldAnchor = screenToWorld(cam, anchor.x, anchor.y)
  const next: Camera = { ...cam, rotation: cam.rotation + deltaRadians }
  const afterScreen = worldToScreen(next, worldAnchor.x, worldAnchor.y)
  const cos = Math.cos(-next.rotation)
  const sin = Math.sin(-next.rotation)
  const errX = (afterScreen.x - anchor.x) / next.zoom
  const errY = (afterScreen.y - anchor.y) / next.zoom
  next.x += errX * cos - errY * sin
  next.y += errX * sin + errY * cos
  return next
}

/** Pan by a screen-space delta (accounts for zoom & rotation). */
export function panBy(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  const ix = dxScreen / cam.zoom
  const iy = dyScreen / cam.zoom
  const cos = Math.cos(-cam.rotation)
  const sin = Math.sin(-cam.rotation)
  return {
    ...cam,
    x: cam.x - (ix * cos - iy * sin),
    y: cam.y - (ix * sin + iy * cos),
  }
}
