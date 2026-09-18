import type { Camera, StrokePoint } from '@/model/types'
import { panBy, rotateAt, screenToWorld, zoomAt } from '@/engine/camera'
import type { LiveStroke } from '@/engine/renderer/types'

export interface ControllerCallbacks {
  getCamera: () => Camera
  setCamera: (c: Camera) => void
  beginStroke: () => LiveStroke | null
  extendStroke: (points: StrokePoint[]) => void
  endStroke: () => void
  cancelStroke: () => void
  /** True while a modifier forces panning (e.g. space held / middle mouse). */
  isPanKeyHeld: () => boolean
}

interface ActivePointer {
  id: number
  type: string
  x: number
  y: number
}

/**
 * Unifies mouse / touch / pen input via Pointer Events:
 *  - primary pen/mouse (or single finger when no pen present) -> drawing
 *  - two fingers -> pan + pinch-zoom + twist-rotate
 *  - space / middle-mouse -> pan
 *  - wheel -> pan; ctrl/pinch wheel -> zoom
 * Uses getCoalescedEvents() for high-frequency stylus sampling.
 */
export class PointerController {
  private el: HTMLElement
  private cb: ControllerCallbacks
  private pointers = new Map<number, ActivePointer>()
  private drawingId: number | null = null
  private panning = false
  private lastPan = { x: 0, y: 0 }
  private penSeen = false

  // gesture (two-finger) state
  private gesture: {
    ids: [number, number]
    startDist: number
    startAngle: number
    startCentroid: { x: number; y: number }
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

  private localPoint(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private pressureOf(e: PointerEvent): number {
    if (e.pointerType === 'pen') return e.pressure > 0 ? e.pressure : 0.5
    if (e.pointerType === 'touch') return e.pressure > 0 ? e.pressure : 0.5
    // mouse: no real pressure; use a neutral value (velocity sim handles taper)
    return 0.5
  }

  private toStrokePoint(e: PointerEvent): StrokePoint {
    const p = this.localPoint(e)
    const w = screenToWorld(this.cb.getCamera(), p.x, p.y)
    return { x: w.x, y: w.y, p: this.pressureOf(e) }
  }

  private onDown = (e: PointerEvent) => {
    this.el.setPointerCapture?.(e.pointerId)
    const p = this.localPoint(e)
    this.pointers.set(e.pointerId, { id: e.pointerId, type: e.pointerType, x: p.x, y: p.y })
    if (e.pointerType === 'pen') this.penSeen = true

    const touchCount = [...this.pointers.values()].filter((pt) => pt.type === 'touch').length

    // Two-finger gesture takes over (cancel any active stroke).
    if (touchCount >= 2) {
      if (this.drawingId !== null) {
        this.cb.cancelStroke()
        this.drawingId = null
      }
      this.startGesture()
      return
    }

    // Pan via middle mouse or held space.
    const wantPan =
      (e.pointerType === 'mouse' && e.button === 1) || this.cb.isPanKeyHeld()
    if (wantPan) {
      this.panning = true
      this.lastPan = p
      return
    }

    // Palm rejection: once a pen is in use, ignore finger touches for drawing.
    if (e.pointerType === 'touch' && this.penSeen) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    // Begin drawing.
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

    if (this.drawingId === e.pointerId) {
      const events =
        'getCoalescedEvents' in e && typeof e.getCoalescedEvents === 'function'
          ? e.getCoalescedEvents()
          : [e]
      const pts = (events.length ? events : [e]).map((ev) =>
        this.toStrokePoint(ev as PointerEvent),
      )
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
    this.gesture = null
    this.panning = false
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const anchor = this.localPoint(e)
    const cam = this.cb.getCamera()
    if (e.ctrlKey) {
      // pinch-zoom on trackpads reports ctrlKey; also Ctrl+wheel on mouse
      const factor = Math.exp(-e.deltaY * 0.01)
      this.cb.setCamera(zoomAt(cam, factor, anchor))
    } else {
      this.cb.setCamera(panBy(cam, -e.deltaX, -e.deltaY))
    }
  }

  // --- two-finger gesture ---
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
    const centroid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    this.gesture = {
      ids: [a.id, b.id],
      startDist: dist || 1,
      startAngle: angle,
      startCentroid: centroid,
      lastCentroid: centroid,
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
    // pan by centroid delta
    const dx = centroid.x - this.gesture.lastCentroid.x
    const dy = centroid.y - this.gesture.lastCentroid.y
    cam = panBy(cam, dx, dy)
    // zoom by distance ratio (relative to last frame)
    const prevDist = this.gesture.startDist
    const factor = dist / prevDist
    cam = zoomAt(cam, factor, centroid)
    // rotate by angle delta
    const dAngle = angle - this.gesture.startAngle
    cam = rotateAt(cam, dAngle, centroid)

    this.cb.setCamera(cam)
    this.gesture.startDist = dist
    this.gesture.startAngle = angle
    this.gesture.lastCentroid = centroid
  }
}
