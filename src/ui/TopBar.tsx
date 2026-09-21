import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { IconButton, Panel } from './primitives'
import { DownloadIcon, HomeIcon, LayersIcon, RedoIcon, UndoIcon } from './icons'
import { exportImage, exportJSON } from '@/persistence/exporter'
import { isCloudEnabled } from '@/services/firebase'
import { CloudMenu } from './CloudMenu'

export function TopBar({
  touch,
  onOpenGallery,
  onToggleLayers,
  layersOpen,
}: {
  touch: boolean
  onOpenGallery: () => void
  onToggleLayers: () => void
  layersOpen: boolean
}) {
  const title = useStore((s) => s.doc.title)
  const setTitle = useStore((s) => s.setTitle)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)
  const dirty = useStore((s) => s.dirty)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const cloud = isCloudEnabled()

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menu])

  const doExport = async (kind: 'png' | 'jpeg' | 'json') => {
    setMenu(false)
    const doc = useStore.getState().doc
    if (kind === 'json') exportJSON(doc)
    else await exportImage(doc, kind)
  }

  const btn = touch ? 'h-12 w-12' : 'h-10 w-10'

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <Panel className="flex items-center gap-1 p-1.5">
        <IconButton className={btn} label="Home / Gallery" onClick={onOpenGallery}>
          <HomeIcon />
        </IconButton>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-40 rounded-lg bg-transparent px-2 py-1 text-sm text-white/90 outline-none placeholder:text-white/30 focus:bg-white/5"
          placeholder="Untitled"
        />
        <span
          className={
            'mr-1 h-2 w-2 rounded-full transition-colors ' +
            (dirty ? 'bg-amber-400' : 'bg-emerald-400')
          }
          title={dirty ? 'Saving…' : 'Saved'}
        />
      </Panel>

      <Panel className="flex items-center gap-1 p-1.5">
        <IconButton className={btn} label="Undo (Ctrl+Z)" disabled={past === 0} onClick={undo}>
          <UndoIcon />
        </IconButton>
        <IconButton
          className={btn}
          label="Redo (Ctrl+Shift+Z)"
          disabled={future === 0}
          onClick={redo}
        >
          <RedoIcon />
        </IconButton>
      </Panel>

      <Panel className="flex items-center gap-1 p-1.5">
        <IconButton
          className={btn}
          active={layersOpen}
          label="Layers"
          onClick={onToggleLayers}
        >
          <LayersIcon />
        </IconButton>

        <div ref={menuRef} className="relative">
          <IconButton className={btn} label="Export" onClick={() => setMenu((m) => !m)}>
            <DownloadIcon />
          </IconButton>
          {menu && (
            <div className="absolute right-0 top-full z-30 mt-2">
              <Panel className="w-44 p-1.5">
                <MenuItem onClick={() => doExport('png')}>Export PNG</MenuItem>
                <MenuItem onClick={() => doExport('jpeg')}>Export JPEG</MenuItem>
                <MenuItem onClick={() => doExport('json')}>Export project (.json)</MenuItem>
              </Panel>
            </div>
          )}
        </div>

        {cloud && <CloudMenu touch={touch} />}
      </Panel>
    </div>
  )
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}
