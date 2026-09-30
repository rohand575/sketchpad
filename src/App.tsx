import { useEffect, useState } from 'react'
import { useStore } from '@/store/store'
import { EditorShell } from '@/ui/EditorShell'
import { getLastDocId, loadDocument, saveDocument, rememberLastDoc } from '@/persistence/db'
import { createDocument, createStroke } from '@/model/factory'
import type { StrokePoint } from '@/model/types'
import { useCloud } from '@/hooks/useCloud'

// Dev-only: inject demo strokes with ?demo to visually verify the paint engine.
function injectDemo() {
  const s = useStore.getState()
  const layerId = s.activeLayerId
  const wave: StrokePoint[] = []
  for (let i = 0; i <= 60; i++) {
    wave.push({ x: 300 + i * 40, y: 900 + Math.sin(i * 0.25) * 260, p: 0.25 + 0.7 * Math.abs(Math.sin(i * 0.18)) })
  }
  const diag: StrokePoint[] = []
  for (let i = 0; i <= 40; i++) diag.push({ x: 500 + i * 45, y: 1900 - i * 20, p: i / 40 })
  const band: StrokePoint[] = []
  for (let i = 0; i <= 30; i++) band.push({ x: 500 + i * 60, y: 500, p: 1 })
  s.addElement(createStroke({ layerId, brushId: 'studio-pen', color: '#1e3a8a', size: 22, opacity: 1, points: wave }))
  s.addElement(createStroke({ layerId, brushId: 'pencil-6b', color: '#111827', size: 40, opacity: 0.9, points: diag }))
  s.addElement(createStroke({ layerId, brushId: 'marker', color: '#f59e0b', size: 90, opacity: 0.5, points: band }))
}

export default function App() {
  const loadDoc = useStore((s) => s.loadDocument)
  const [ready, setReady] = useState(false)
  useCloud()

  useEffect(() => {
    if (!ready) return
    if (typeof location !== 'undefined' && location.search.includes('demo')) {
      injectDemo()
    }
  }, [ready])

  useEffect(() => {
    let settled = false
    const finish = (doc: ReturnType<typeof createDocument>) => {
      if (settled) return
      settled = true
      window.clearTimeout(fallback)
      loadDoc(doc)
      rememberLastDoc(doc.id)
      setReady(true)
    }
    // If IndexedDB is slow or unavailable, don't hang on the loading screen —
    // fall back to a fresh in-memory document.
    const fallback = window.setTimeout(() => finish(createDocument()), 2500)
    ;(async () => {
      try {
        const lastId = getLastDocId()
        let doc = lastId ? await loadDocument(lastId) : undefined
        if (!doc) {
          doc = createDocument()
          await saveDocument(doc)
        }
        finish(doc)
      } catch {
        finish(createDocument())
      }
    })()
    return () => {
      settled = true
      window.clearTimeout(fallback)
    }
  }, [loadDoc])

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-white/60">
        <div className="animate-pulse text-sm tracking-wide">Loading Sketchpad…</div>
      </div>
    )
  }

  return <EditorShell />
}
