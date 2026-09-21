import { useEffect, useRef } from 'react'
import { useStore } from '@/store/store'
import { Canvas2DRenderer } from '@/engine/renderer/canvas2d'
import type { LiveStroke, ScreenRect } from '@/engine/renderer/types'
import { PointerController } from '@/engine/input/PointerController'
import { createStroke } from '@/model/factory'
import { boundsOfElements } from '@/engine/selection'
import type { Camera, StrokePoint } from '@/model/types'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Canvas2DRenderer | null>(null)
  const liveRef = useRef<LiveStroke | null>(null)
  const marqueeRef = useRef<ScreenRect | null>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const spaceRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(true)

  useKeyboardShortcuts(spaceRef)

  useEffect(() => {
    const canvas = canvasRef.current!
    const container = containerRef.current!
    const renderer = new Canvas2DRenderer()
    renderer.attach(canvas)
    rendererRef.current = renderer

    const scheduleRender = () => {
      dirtyRef.current = true
    }

    const renderFrame = () => {
      rafRef.current = requestAnimationFrame(renderFrame)
      if (!dirtyRef.current) return
      dirtyRef.current = false
      const s = useStore.getState()
      let selectionBounds = null
      if (s.selectedIds.length > 0) {
        const ids = new Set(s.selectedIds)
        selectionBounds = boundsOfElements(s.doc.elements.filter((e) => ids.has(e.id)))
      }
      renderer.render({
        doc: s.doc,
        camera: s.doc.camera,
        width: sizeRef.current.w,
        height: sizeRef.current.h,
        dpr: sizeRef.current.dpr,
        layerVersion: s.layerVersion,
        live: liveRef.current,
        selectionBounds,
        marquee: marqueeRef.current,
      })
    }
    rafRef.current = requestAnimationFrame(renderFrame)

    // Keep canvas sized to its container in device pixels.
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      sizeRef.current = {
        w: rect.width,
        h: rect.height,
        dpr: Math.max(1, window.devicePixelRatio || 1),
      }
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      scheduleRender()
    })
    ro.observe(container)

    // Re-render whenever the document / camera / tool changes.
    const unsub = useStore.subscribe(scheduleRender)

    // --- input wiring ---
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
          brush: t.tool,
          color: t.color,
          size: t.sizes[t.tool],
          opacity: t.opacities[t.tool],
          points: [],
        }
        liveRef.current = live
        return live
      },
      extendStroke: (points: StrokePoint[]) => {
        if (!liveRef.current) return
        liveRef.current.points.push(...points)
        scheduleRender()
      },
      endStroke: () => {
        const live = liveRef.current
        liveRef.current = null
        if (!live || live.points.length === 0) {
          scheduleRender()
          return
        }
        const stroke = createStroke({
          layerId: live.layerId,
          brush: live.brush,
          color: live.color,
          size: live.size,
          opacity: live.opacity,
          points: live.points,
        })
        useStore.getState().addElement(stroke)
        scheduleRender()
      },
      cancelStroke: () => {
        liveRef.current = null
        scheduleRender()
      },
    })

    const onDprChange = () => scheduleRender()
    window.addEventListener('resize', onDprChange)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      unsub()
      controller.dispose()
      renderer.dispose()
      window.removeEventListener('resize', onDprChange)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none overscroll-none select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
