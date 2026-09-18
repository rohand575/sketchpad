import { useEffect, useRef } from 'react'
import { useStore } from '@/store/store'
import { Canvas2DRenderer } from '@/engine/renderer/canvas2d'
import type { LiveStroke } from '@/engine/renderer/types'
import { PointerController } from '@/engine/input/PointerController'
import { createStroke } from '@/model/factory'
import type { Camera, StrokePoint } from '@/model/types'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<Canvas2DRenderer | null>(null)
  const liveRef = useRef<LiveStroke | null>(null)
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
      renderer.render({
        doc: s.doc,
        camera: s.doc.camera,
        width: sizeRef.current.w,
        height: sizeRef.current.h,
        dpr: sizeRef.current.dpr,
        layerVersion: s.layerVersion,
        live: liveRef.current,
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
      isPanKeyHeld: () => spaceRef.current,
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
