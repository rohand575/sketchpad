import { useEffect } from 'react'
import { useStore } from '@/store/store'
import { BRUSH_PRESETS } from '@/engine/brushes/presets'
import type { BrushType } from '@/model/types'

const TOOL_KEYS: Record<string, BrushType> = {
  b: 'pen',
  p: 'pencil',
  m: 'marker',
  e: 'eraser',
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
        const preset = BRUSH_PRESETS[s.tool.tool]
        const cur = s.tool.sizes[s.tool.tool]
        const step = Math.max(1, Math.round(cur * 0.15))
        const next = Math.min(preset.maxSize, Math.max(preset.minSize, cur + delta * step))
        s.setBrushSize(next)
        return
      }
      const tool = TOOL_KEYS[e.key.toLowerCase()]
      if (tool) s.setTool(tool)
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
