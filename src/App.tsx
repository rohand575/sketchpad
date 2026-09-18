import { useEffect, useState } from 'react'
import { useStore } from '@/store/store'
import { EditorShell } from '@/ui/EditorShell'
import { getLastDocId, loadDocument, saveDocument, rememberLastDoc } from '@/persistence/db'
import { createDocument } from '@/model/factory'

export default function App() {
  const loadDoc = useStore((s) => s.loadDocument)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const lastId = getLastDocId()
      let doc = lastId ? await loadDocument(lastId) : undefined
      if (!doc) {
        doc = createDocument()
        await saveDocument(doc)
      }
      if (cancelled) return
      loadDoc(doc)
      rememberLastDoc(doc.id)
      setReady(true)
    })()
    return () => {
      cancelled = true
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
