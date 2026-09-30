import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { IconButton, Panel } from './primitives'
import { DownloadIcon, HomeIcon, LayersIcon, MoreIcon, RedoIcon, UndoIcon } from './icons'
import { exportImage, exportJSON } from '@/persistence/exporter'
import { isCloudEnabled } from '@/services/firebase'
import { CloudMenu } from './CloudMenu'

interface TopBarProps {
  touch: boolean
  phone: boolean
  onOpenGallery: () => void
  onToggleLayers: () => void
  layersOpen: boolean
}

export function TopBar(props: TopBarProps) {
  return props.phone ? <CompactTopBar {...props} /> : <FullTopBar {...props} />
}

function useExport() {
  return async (kind: 'png' | 'jpeg' | 'json') => {
    const doc = useStore.getState().doc
    if (kind === 'json') exportJSON(doc)
    else await exportImage(doc, kind)
  }
}

function SavedDot() {
  const dirty = useStore((s) => s.dirty)
  return (
    <span
      className={
        'h-2 w-2 shrink-0 rounded-full transition-colors ' +
        (dirty ? 'bg-amber-400' : 'bg-emerald-400')
      }
      title={dirty ? 'Saving…' : 'Saved'}
    />
  )
}

function TitleInput({ className = '' }: { className?: string }) {
  const title = useStore((s) => s.doc.title)
  const setTitle = useStore((s) => s.setTitle)
  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      className={
        'min-w-0 rounded-lg bg-transparent px-2 py-1 text-sm text-white/90 outline-none placeholder:text-white/30 focus:bg-white/5 ' +
        className
      }
      placeholder="Untitled"
    />
  )
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open, close])
  return ref
}

// --- Desktop / tablet: three grouped panels ---
function FullTopBar({ touch, onOpenGallery, onToggleLayers, layersOpen }: TopBarProps) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)
  const [menu, setMenu] = useState(false)
  const doExport = useExport()
  const menuRef = useOutsideClose(menu, () => setMenu(false))
  const cloud = isCloudEnabled()
  const btn = touch ? 'h-12 w-12' : 'h-10 w-10'

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <Panel className="flex items-center gap-1 p-1.5">
        <IconButton className={btn} label="Home / Gallery" onClick={onOpenGallery}>
          <HomeIcon />
        </IconButton>
        <TitleInput className="w-40" />
        <SavedDot />
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
        <IconButton className={btn} active={layersOpen} label="Layers" onClick={onToggleLayers}>
          <LayersIcon />
        </IconButton>
        <div ref={menuRef} className="relative">
          <IconButton className={btn} label="Export" onClick={() => setMenu((m) => !m)}>
            <DownloadIcon />
          </IconButton>
          {menu && (
            <div className="absolute right-0 top-full z-30 mt-2">
              <Panel className="w-44 p-1.5">
                <MenuItem onClick={() => { setMenu(false); doExport('png') }}>Export PNG</MenuItem>
                <MenuItem onClick={() => { setMenu(false); doExport('jpeg') }}>Export JPEG</MenuItem>
                <MenuItem onClick={() => { setMenu(false); doExport('json') }}>
                  Export project (.json)
                </MenuItem>
              </Panel>
            </div>
          )}
        </div>
        {cloud && <CloudMenu touch={touch} />}
      </Panel>
    </div>
  )
}

// --- Phone: one compact row + overflow sheet ---
function CompactTopBar({ onOpenGallery, onToggleLayers }: TopBarProps) {
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)
  const [menu, setMenu] = useState(false)
  const doExport = useExport()
  const menuRef = useOutsideClose(menu, () => setMenu(false))
  const cloud = isCloudEnabled()
  const btn = 'h-10 w-10'

  return (
    <Panel className="pointer-events-auto flex w-[94vw] max-w-lg items-center gap-0.5 p-1.5">
      <IconButton className={btn} label="Gallery" onClick={onOpenGallery}>
        <HomeIcon />
      </IconButton>
      <TitleInput className="flex-1" />
      <SavedDot />
      <IconButton className={btn} label="Undo" disabled={past === 0} onClick={undo}>
        <UndoIcon />
      </IconButton>
      <IconButton className={btn} label="Redo" disabled={future === 0} onClick={redo}>
        <RedoIcon />
      </IconButton>
      {cloud && <CloudMenu touch={false} />}
      <div ref={menuRef} className="relative">
        <IconButton className={btn} label="More" onClick={() => setMenu((m) => !m)}>
          <MoreIcon />
        </IconButton>
        {menu && (
          <div className="absolute right-0 top-full z-30 mt-2">
            <Panel className="w-48 p-1.5">
              <MenuItem
                onClick={() => {
                  setMenu(false)
                  onToggleLayers()
                }}
              >
                Layers
              </MenuItem>
              <div className="my-1 h-px bg-white/10" />
              <MenuItem onClick={() => { setMenu(false); doExport('png') }}>Export PNG</MenuItem>
              <MenuItem onClick={() => { setMenu(false); doExport('jpeg') }}>Export JPEG</MenuItem>
              <MenuItem onClick={() => { setMenu(false); doExport('json') }}>
                Export project (.json)
              </MenuItem>
            </Panel>
          </div>
        )}
      </div>
    </Panel>
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
