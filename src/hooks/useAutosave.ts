import { useEffect, useRef } from 'react'
import { useStore } from '@/store/store'
import { rememberLastDoc, saveDocument } from '@/persistence/db'
import { makeThumbnail } from '@/persistence/exporter'

/** Debounced autosave to IndexedDB whenever the document changes. */
export function useAutosave(delay = 800): void {
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      if (state.doc === prev.doc && state.dirty === prev.dirty) return
      if (!state.dirty) return
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(async () => {
        const { doc } = useStore.getState()
        let thumb: string | undefined
        try {
          thumb = makeThumbnail(doc)
        } catch {
          thumb = undefined
        }
        await saveDocument(doc, thumb)
        rememberLastDoc(doc.id)
        useStore.getState().markSaved()
      }, delay)
    })
    return () => {
      unsub()
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [delay])
}
