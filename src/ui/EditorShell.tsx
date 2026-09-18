import { useState } from 'react'
import { CanvasView } from './CanvasView'
import { Toolbar } from './Toolbar'
import { TopBar } from './TopBar'
import { LayersPanel } from './LayersPanel'
import { Gallery } from './Gallery'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useAutosave } from '@/hooks/useAutosave'

export function EditorShell() {
  const { isTouch } = useDeviceType()
  const [showGallery, setShowGallery] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
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

      {showGallery && <Gallery onClose={() => setShowGallery(false)} />}
    </div>
  )
}
