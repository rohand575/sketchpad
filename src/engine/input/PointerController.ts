import type { Bounds, Camera, Element, StrokePoint } from '@/model/types'
import { panBy, rotateAt, screenToWorld, worldToScreen, zoomAt, type Point } from '@/engine/camera'
import type { LiveStroke } from '@/engine/renderer/types'
import {
  applyMatrixToElement,
  boundsCenter,
  elementsInRect,
  handleLayout,
  hitHandle,
  hitTest,
  oppositeCorner,
  rotateAbout,
  scaleAbout,
  translation,
  type Matrix,
} from '@/engine/selection'

export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

export interface SelectionCallbacks {
  getElements: () => Element[]
  getSelectedIds: () => string[]
  getSelectionBounds: () => Bounds | null
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  beginInteraction: () => void
  previewElements: (elements: Element[]) => void
  endInteraction: () => void
  onMarquee: (rect: ScreenRect | null) => void
}

export interface ControllerCallbacks {
  getCamera: () => Camera
  setCamera: (c: Camera) => void
  getMode: () => 'draw' | 'select'
  beginStroke: () => LiveStroke | null
  extendStroke: (points: StrokePoint[]) => void
  endStroke: () => void
  cancelStroke: () => void
  isPanKeyHeld: () => boolean
  select: SelectionCallbacks
}

interface ActivePointer {
  id: number
  type: string
  x: number
  y: number
}

type SelectAction = 'move' | 'scale' | 'rotate' | 'marquee' | null

const TAP_THRESHOLD = 4

export class PointerController {
  private el: HTMLElement
  private cb: ControllerCallbacks
  private pointers = new Map<number, ActivePointer>()
  private drawingId: number | null = null
  private panning = false
  private lastPan = { x: 0, y: 0 }
  private penSeen = false

  // selection interaction
  private selectAction: SelectAction = null
  private selectPointerId: number | null = null
  private downScreen: Point = { x: 0, y: 0 }
  private moved = false
  private snapshot: Element[] = []
  private snapshotIds = new Set<string>()
  private moveStart: Point = { x: 0, y: 0 }
  private scaleAnchor: Point = { x: 0, y: 0 }
  private scaleStartDist = 1
  private rotateCenter: Point = { x: 0, y: 0 }
  private rotateStartAngle = 0

  private gesture: {
    ids: [number, number]
    startDist: number
    startAngle: number
    lastCentroid: { x: number; y: number }
  } | null = null

  constructor(el: HTMLElement, cb: ControllerCallbacks) {
    this.el = el
    this.cb = cb
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onCancel)
    el.addEventListener('pointerleave', this.onUp)
    el.addEventListener('wheel', this.onWheel, { passive: false })
  }

  dispose(): void {
    const el = this.el
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointercancel', this.onCancel)
    el.removeEventListener('pointerleave', this.onUp)
    el.removeEventListener('wheel', this.onWheel)
  }

  private localPoint(e: PointerEvent | WheelEvent): Point {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private pressureOf(e: PointerEvent): number {
    if (e.pointerType === 'pen' || e.pointerType === 'touch') {
      return e.pressure > 0 ? e.pressure : 0.5
    }
    return 0.5
  }

  private toStrokePoint(e: PointerEvent): StrokePoint {
    const p = this.localPoint(e)
    const w = screenToWorld(this.cb.getCamera(), p.x, p.y)
    return { x: w.x, y: w.y, p: this.pressureOf(e) }
  }

  private worldAt(e: PointerEvent): Point {
    const p = this.localPoint(e)
    return screenToWorld(this.cb.getCamera(), p.x, p.y)
  }

  private onDown = (e: PointerEvent) => {
    this.el.setPointerCapture?.(e.pointerId)
    const p = this.localPoint(e)
    this.pointers.set(e.pointerId, { id: e.pointerId, type: e.pointerType, x: p.x, y: p.y })
    if (e.pointerType === 'pen') this.penSeen = true

    const touchCount = [...this.pointers.values()].filter((pt) => pt.type === 'touch').length
    if (touchCount >= 2) {
      if (this.drawingId !== null) {
        this.cb.cancelStroke()
        this.drawingId = null
      }
      this.cancelSelectAction()
      this.startGesture()
      return
    }

    const wantPan = (e.pointerType === 'mouse' && e.button === 1) || this.cb.isPanKeyHeld()
    if (wantPan) {
      this.panning = true
      this.lastPan = p
      return
    }

    if (e.pointerType === 'touch' && this.penSeen) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    if (this.cb.getMode() === 'select') {
      this.onSelectDown(e)
      return
    }

    const live = this.cb.beginStroke()
    if (live) {
      this.drawingId = e.pointerId
      this.cb.extendStroke([this.toStrokePoint(e)])
    }
  }

  private onMove = (e: PointerEvent) => {
    const rec = this.pointers.get(e.pointerId)
    if (rec) {
      const p = this.localPoint(e)
      rec.x = p.x
      rec.y = p.y
    }

    if (this.gesture) {
      this.updateGesture()
      return
    }
    if (this.panning) {
      const p = this.localPoint(e)
      const dx = p.x - this.lastPan.x
      const dy = p.y - this.lastPan.y
      this.lastPan = p
      this.cb.setCamera(panBy(this.cb.getCamera(), dx, dy))
      return
    }
    if (this.selectPointerId === e.pointerId) {
      this.onSelectMove(e)
      return
    }
    if (this.drawingId === e.pointerId) {
      const events =
        'getCoalescedEvents' in e && typeof e.getCoalescedEvents === 'function'
          ? e.getCoalescedEvents()
          : [e]
      const pts = (events.length ? events : [e]).map((ev) => this.toStrokePoint(ev as PointerEvent))
      this.cb.extendStroke(pts)
    }
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    this.el.releasePointerCapture?.(e.pointerId)

    if (this.gesture) {
      const [a, b] = this.gesture.ids
      if (e.pointerId === a || e.pointerId === b) this.gesture = null
      return
    }
    if (this.panning) {
      this.panning = false
      return
    }
    if (this.selectPointerId === e.pointerId) {
      this.onSelectUp(e)
      return
    }
    if (this.drawingId === e.pointerId) {
      this.cb.endStroke()
      this.drawingId = null
    }
  }

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.drawingId === e.pointerId) {
      this.cb.cancelStroke()
      this.drawingId = null
    }
    if (this.selectPointerId === e.pointerId) this.cancelSelectAction()
    this.gesture = null
    this.panning = false
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const anchor = this.localPoint(e)
    const cam = this.cb.getCamera()
    if (e.ctrlKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      this.cb.setCamera(zoomAt(cam, factor, anchor))
    } else {
      this.cb.setCamera(panBy(cam, -e.deltaX, -e.deltaY))
    }
  }

  // --- selection ---
  private onSelectDown(e: PointerEvent): void {
    this.selectPointerId = e.pointerId
    this.downScreen = this.localPoint(e)
    this.moved = false

    const sel = this.cb.select
    const bounds = sel.getSelectionBounds()
    const cam = this.cb.getCamera()
    const wp = this.worldAt(e)

    if (bounds) {
      const layout = handleLayout(bounds, cam)
      const handle = hitHandle(layout, this.downScreen)
      if (handle === 'rotate') {
        this.beginTransform('rotate')
        this.rotateCenter = boundsCenter(bounds)
        this.rotateStartAngle = Math.atan2(wp.y - this.rotateCenter.y, wp.x - this.rotateCenter.x)
        return
      }
      if (handle) {
        this.beginTransform('scale')
        this.scaleAnchor = layout.worldCorners[oppositeCorner(handle)]
        this.scaleStartDist =
          Math.hypot(wp.x - this.scaleAnchor.x, wp.y - this.scaleAnchor.y) || 1
        return
      }
      // Inside the selection box -> move.
      if (
        wp.x >= bounds.minX &&
        wp.x <= bounds.maxX &&
        wp.y >= bounds.minY &&
        wp.y <= bounds.maxY
      ) {
        this.beginTransform('move')
        this.moveStart = wp
        return
      }
    }
    // Otherwise start a marquee (may resolve to a tap-select on release).
    this.selectAction = 'marquee'
  }

  private beginTransform(action: Exclude<SelectAction, 'marquee' | null>): void {
    const sel = this.cb.select
    this.selectAction = action
    this.snapshot = sel.getElements()
    this.snapshotIds = new Set(sel.getSelectedIds())
    sel.beginInteraction()
  }

  private applyMatrix(m: Matrix): void {
    const next = this.snapshot.map((el) =>
      this.snapshotIds.has(el.id) ? applyMatrixToElement(el, m) : el,
    )
    this.cb.select.previewElements(next)
  }

  private onSelectMove(e: PointerEvent): void {
    const p = this.localPoint(e)
    if (Math.hypot(p.x - this.downScreen.x, p.y - this.downScreen.y) > TAP_THRESHOLD) {
      this.moved = true
    }
    const wp = this.worldAt(e)

    switch (this.selectAction) {
      case 'move':
        this.applyMatrix(translation(wp.x - this.moveStart.x, wp.y - this.moveStart.y))
        break
      case 'scale': {
        const dist = Math.hypot(wp.x - this.scaleAnchor.x, wp.y - this.scaleAnchor.y)
        const factor = Math.max(0.05, dist / this.scaleStartDist)
        this.applyMatrix(scaleAbout(factor, this.scaleAnchor))
        break
      }
      case 'rotate': {
        const angle = Math.atan2(wp.y - this.rotateCenter.y, wp.x - this.rotateCenter.x)
        this.applyMatrix(rotateAbout(angle - this.rotateStartAngle, this.rotateCenter))
        break
      }
      case 'marquee':
        this.cb.select.onMarquee(this.rectFrom(this.downScreen, p))
        break
    }
  }

  private onSelectUp(e: PointerEvent): void {
    const sel = this.cb.select
    const action = this.selectAction
    this.selectPointerId = null
    this.selectAction = null

    if (action === 'marquee') {
      sel.onMarquee(null)
      if (this.moved) {
        const cam = this.cb.getCamera()
        const a = screenToWorld(cam, this.downScreen.x, this.downScreen.y)
        const b = this.worldAt(e)
        const rect: Bounds = {
          minX: Math.min(a.x, b.x),
          minY: Math.min(a.y, b.y),
          maxX: Math.max(a.x, b.x),
          maxY: Math.max(a.y, b.y),
        }
        sel.setSelection(elementsInRect(sel.getElements(), rect))
      } else {
        // tap: select topmost element under the cursor, or clear.
        const cam = this.cb.getCamera()
        const wp = this.worldAt(e)
        const tol = 6 / cam.zoom
        const id = hitTest(sel.getElements(), wp.x, wp.y, tol)
        if (id) sel.setSelection([id])
        else sel.clearSelection()
      }
      return
    }

    if (action === 'move' || action === 'scale' || action === 'rotate') {
      sel.endInteraction()
    }
  }

  private cancelSelectAction(): void {
    if (this.selectAction && this.selectAction !== 'marquee') {
      this.cb.select.endInteraction()
    }
    this.cb.select.onMarquee(null)
    this.selectAction = null
    this.selectPointerId = null
  }

  private rectFrom(a: Point, b: Point): ScreenRect {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(a.x - b.x),
      h: Math.abs(a.y - b.y),
    }
  }

  // --- two-finger gesture (works in both modes) ---
  private twoTouchPoints(): [ActivePointer, ActivePointer] | null {
    const touches = [...this.pointers.values()].filter((p) => p.type === 'touch')
    if (touches.length < 2) return null
    return [touches[0], touches[1]]
  }

  private startGesture(): void {
    const pair = this.twoTouchPoints()
    if (!pair) return
    const [a, b] = pair
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    this.gesture = {
      ids: [a.id, b.id],
      startDist: dist || 1,
      startAngle: angle,
      lastCentroid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  private updateGesture(): void {
    if (!this.gesture) return
    const pair = this.twoTouchPoints()
    if (!pair) return
    const [a, b] = pair
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const centroid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }

    let cam = this.cb.getCamera()
    cam = panBy(cam, centroid.x - this.gesture.lastCentroid.x, centroid.y - this.gesture.lastCentroid.y)
    cam = zoomAt(cam, dist / this.gesture.startDist, centroid)
    cam = rotateAt(cam, angle - this.gesture.startAngle, centroid)

    this.cb.setCamera(cam)
    this.gesture.startDist = dist
    this.gesture.startAngle = angle
    this.gesture.lastCentroid = centroid
  }
}

// Re-export for callers that position handles (renderer overlay).
export { worldToScreen }
