import { useEffect, useRef } from 'react'
import { useStore } from '@/store/store'
import { Canvas2DRenderer } from '@/engine/renderer/canvas2d'
import { WebGLRenderer, isWebGL2Available } from '@/engine/gl/WebGLRenderer'
import type { LiveStroke, PaintEngine, SceneInput } from '@/engine/renderer/types'
import type { ScreenRect } from '@/engine/input/PointerController'
import { PointerController } from '@/engine/input/PointerController'
import { createStroke } from '@/model/factory'
import { boundsOfElements, handleLayout } from '@/engine/selection'
import type { Camera, StrokePoint } from '@/model/types'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const ACCENT = '#7c5cff'

function createEngine(canvas: HTMLCanvasElement): PaintEngine {
  const force2d =
    typeof location !== 'undefined' && location.search.includes('engine=2d')
  if (!force2d && isWebGL2Available()) {
    try {
      const gl = new WebGLRenderer()
      gl.attach(canvas)
      return gl
    } catch {
      /* fall through to Canvas2D */
    }
  }
  const c2d = new Canvas2DRenderer()
  c2d.attach(canvas)
  return c2d
}

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PaintEngine | null>(null)
  const livePointsRef = useRef<StrokePoint[]>([])
  const liveParamsRef = useRef<LiveStroke | null>(null)
  const marqueeRef = useRef<ScreenRect | null>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const spaceRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(true)
  const fittedRef = useRef<string>('')

  useKeyboardShortcuts(spaceRef)

  useEffect(() => {
    const canvas = canvasRef.current!
    const overlay = overlayRef.current!
    const container = containerRef.current!
    const engine = createEngine(canvas)
    engineRef.current = engine
    const octx = overlay.getContext('2d')!

    const scheduleRender = () => {
      dirtyRef.current = true
    }

    const drawOverlay = () => {
      const { w, h, dpr } = sizeRef.current
      const dw = Math.max(1, Math.round(w * dpr))
      const dh = Math.max(1, Math.round(h * dpr))
      if (overlay.width !== dw || overlay.height !== dh) {
        overlay.width = dw
        overlay.height = dh
      }
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx.clearRect(0, 0, w, h)
      const s = useStore.getState()
      // marquee
      if (marqueeRef.current) {
        const m = marqueeRef.current
        octx.strokeStyle = ACCENT
        octx.fillStyle = 'rgba(124,92,255,0.12)'
        octx.lineWidth = 1
        octx.setLineDash([5, 4])
        octx.fillRect(m.x, m.y, m.w, m.h)
        octx.strokeRect(m.x, m.y, m.w, m.h)
        octx.setLineDash([])
      }
      // selection box + handles
      if (s.selectedIds.length > 0) {
        const ids = new Set(s.selectedIds)
        const b = boundsOfElements(s.doc.elements.filter((e) => ids.has(e.id)))
        if (b) {
          const l = handleLayout(b, s.doc.camera)
          const c = l.corners
          octx.strokeStyle = ACCENT
          octx.lineWidth = 1.5
          octx.beginPath()
          octx.moveTo(c.nw.x, c.nw.y)
          octx.lineTo(c.ne.x, c.ne.y)
          octx.lineTo(c.se.x, c.se.y)
          octx.lineTo(c.sw.x, c.sw.y)
          octx.closePath()
          octx.stroke()
          octx.beginPath()
          octx.moveTo(l.rotateAnchor.x, l.rotateAnchor.y)
          octx.lineTo(l.rotate.x, l.rotate.y)
          octx.stroke()
          const knob = (x: number, y: number, r: number, round: boolean) => {
            octx.fillStyle = '#fff'
            octx.strokeStyle = ACCENT
            octx.lineWidth = 1.5
            octx.beginPath()
            if (round) octx.arc(x, y, r, 0, Math.PI * 2)
            else octx.rect(x - r, y - r, r * 2, r * 2)
            octx.fill()
            octx.stroke()
          }
          knob(l.rotate.x, l.rotate.y, 6, true)
          ;(['nw', 'ne', 'se', 'sw'] as const).forEach((k) => knob(c[k].x, c[k].y, 5, false))
        }
      }
    }

    const fitIfNeeded = () => {
      const s = useStore.getState()
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) return
      if (fittedRef.current === s.doc.id) return
      const zoom = Math.min(w / s.doc.width, h / s.doc.height) * 0.9
      const cam: Camera = {
        x: s.doc.width / 2 - w / 2 / zoom,
        y: s.doc.height / 2 - h / 2 / zoom,
        zoom,
        rotation: 0,
      }
      fittedRef.current = s.doc.id
      s.setCamera(cam)
    }

    const renderFrame = () => {
      rafRef.current = requestAnimationFrame(renderFrame)
      if (!dirtyRef.current) return
      dirtyRef.current = false
      fitIfNeeded()
      const s = useStore.getState()
      const input: SceneInput = {
        doc: s.doc,
        camera: s.doc.camera,
        width: sizeRef.current.w,
        height: sizeRef.current.h,
        dpr: sizeRef.current.dpr,
        layerVersion: s.layerVersion,
      }
      engine.render(input)
      drawOverlay()
    }
    rafRef.current = requestAnimationFrame(renderFrame)

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      sizeRef.current = {
        w: rect.width,
        h: rect.height,
        dpr: Math.max(1, window.devicePixelRatio || 1),
      }
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
      scheduleRender()
    })
    ro.observe(container)

    const unsub = useStore.subscribe((state, prev) => {
      if (state.doc.id !== prev.doc.id) fittedRef.current = ''
      scheduleRender()
    })

    const controller = new PointerController(canvas, {
      getCamera: () => useStore.getState().doc.camera,
      setCamera: (c: Camera) => {
        useStore.getState().setCamera(c)
        scheduleRender()
      },
      getMode: () => useStore.getState().mode,
      isPanKeyHeld: () => spaceRef.current,
      select: {
        getElements: () => useStore.getState().doc.elements,
        getSelectedIds: () => useStore.getState().selectedIds,
        getSelectionBounds: () => {
          const s = useStore.getState()
          if (s.selectedIds.length === 0) return null
          const ids = new Set(s.selectedIds)
          return boundsOfElements(s.doc.elements.filter((e) => ids.has(e.id)))
        },
        setSelection: (ids) => {
          useStore.getState().setSelection(ids)
          scheduleRender()
        },
        clearSelection: () => {
          useStore.getState().clearSelection()
          scheduleRender()
        },
        beginInteraction: () => useStore.getState().beginInteraction(),
        previewElements: (els) => {
          useStore.getState().previewElements(els)
          scheduleRender()
        },
        endInteraction: () => useStore.getState().endInteraction(),
        onMarquee: (rect) => {
          marqueeRef.current = rect
          scheduleRender()
        },
      },
      beginStroke: () => {
        const s = useStore.getState()
        const layer = s.doc.layers.find((l) => l.id === s.activeLayerId)
        if (!layer || layer.locked || !layer.visible) return null
        const t = s.tool
        const live: LiveStroke = {
          layerId: layer.id,
          brushId: t.brushId,
          color: t.color,
          size: t.sizes[t.brushId],
          opacity: t.opacities[t.brushId],
          alphaLock: layer.alphaLock,
          points: [],
        }
        liveParamsRef.current = live
        livePointsRef.current = []
        engine.beginStroke(live)
        return live
      },
      extendStroke: (points: StrokePoint[]) => {
        if (!liveParamsRef.current) return
        livePointsRef.current.push(...points)
        engine.extendStroke(points)
        scheduleRender()
      },
      endStroke: () => {
        const live = liveParamsRef.current
        const points = livePointsRef.current
        liveParamsRef.current = null
        livePointsRef.current = []
        if (!live || points.length === 0) {
          engine.cancelStroke()
          scheduleRender()
          return
        }
        const stroke = createStroke({
          layerId: live.layerId,
          brushId: live.brushId,
          color: live.color,
          size: live.size,
          opacity: live.opacity,
          alphaLock: live.alphaLock,
          points,
        })
        useStore.getState().addElement(stroke)
        engine.commitStroke()
        scheduleRender()
      },
      cancelStroke: () => {
        liveParamsRef.current = null
        livePointsRef.current = []
        engine.cancelStroke()
        scheduleRender()
      },
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      unsub()
      controller.dispose()
      engine.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none overscroll-none select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  )
}
