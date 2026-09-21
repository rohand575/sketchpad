import { useState } from 'react'
import { CanvasView } from './CanvasView'
import { Toolbar } from './Toolbar'
import { TopBar } from './TopBar'
import { LayersPanel } from './LayersPanel'
import { Gallery } from './Gallery'
import { Panel } from './primitives'
import { TrashIcon } from './icons'
import { useStore } from '@/store/store'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useAutosave } from '@/hooks/useAutosave'

export function EditorShell() {
  const { isTouch } = useDeviceType()
  const [showGallery, setShowGallery] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const selectedCount = useStore((s) => s.selectedIds.length)
  const deleteSelection = useStore((s) => s.deleteSelection)
  const clearSelection = useStore((s) => s.clearSelection)
  useAutosave()

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-900 text-white">
      {/* Drawing surface fills everything; UI floats above it. */}
      <CanvasView />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-3 sm:justify-start sm:p-4">
        <TopBar
          touch={isTouch}
          onOpenGallery={() => setShowGallery(true)}
          onToggleLayers={() => setShowLayers((v) => !v)}
          layersOpen={showLayers}
        />
      </div>

      {/* Left tool dock */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-4">
        <Toolbar touch={isTouch} />
      </div>

      {/* Right layers panel */}
      {showLayers && (
        <div className="pointer-events-auto absolute right-3 top-20 z-20 sm:right-4 sm:top-24">
          <LayersPanel onClose={() => setShowLayers(false)} />
        </div>
      )}

      {/* Selection action bar */}
      {selectedCount > 0 && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
          <Panel className="flex items-center gap-2 px-3 py-2">
            <span className="px-1 text-sm text-white/70">
              {selectedCount} selected
            </span>
            <button
              onClick={() => deleteSelection()}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/30"
            >
              <TrashIcon width={16} height={16} />
              Delete
            </button>
            <button
              onClick={() => clearSelection()}
              className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
            >
              Deselect
            </button>
          </Panel>
        </div>
      )}

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
    </div>
  )
}
