import { useEffect } from 'react'
import { useStore } from '@/store/store'
import { getBrush } from '@/engine/brushes/library'

// Quick brush shortcuts (Procreate-ish): B pen, P pencil, M marker, E eraser.
const BRUSH_KEYS: Record<string, string> = {
  b: 'studio-pen',
  p: 'technical-pencil',
  m: 'marker',
  e: 'eraser-hard',
}

/** Desktop keyboard shortcuts. `spaceRef` is toggled for space-drag panning. */
export function useKeyboardShortcuts(spaceRef: React.MutableRefObject<boolean>): void {
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const s = useStore.getState()
      const meta = e.ctrlKey || e.metaKey

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (e.code === 'Space') {
        spaceRef.current = true
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedIds.length > 0) {
          e.preventDefault()
          s.deleteSelection()
        }
        return
      }
      if (e.key === 'Escape') {
        s.clearSelection()
        return
      }
      if (e.key.toLowerCase() === 'v') {
        s.setMode('select')
        return
      }
      if (e.key === '[' || e.key === ']') {
        const delta = e.key === '[' ? -1 : 1
        const brush = getBrush(s.tool.brushId)
        const cur = s.tool.sizes[s.tool.brushId]
        const step = Math.max(1, Math.round(cur * 0.15))
        const next = Math.min(brush.maxSize, Math.max(brush.minSize, cur + delta * step))
        s.setBrushSize(next)
        return
      }
      const brushId = BRUSH_KEYS[e.key.toLowerCase()]
      if (brushId) s.setBrush(brushId)
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [spaceRef])
}
