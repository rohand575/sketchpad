import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import type { BrushType } from '@/model/types'
import { IconButton, Panel } from './primitives'
import { ColorPicker } from './ColorPicker'
import { BrushControls } from './BrushControls'
import { EraserIcon, MarkerIcon, PenIcon, PencilIcon, SelectIcon } from './icons'

const TOOLS: { type: BrushType; Icon: typeof PenIcon; label: string; key: string }[] = [
  { type: 'pen', Icon: PenIcon, label: 'Pen', key: 'B' },
  { type: 'pencil', Icon: PencilIcon, label: 'Pencil', key: 'P' },
  { type: 'marker', Icon: MarkerIcon, label: 'Marker', key: 'M' },
  { type: 'eraser', Icon: EraserIcon, label: 'Eraser', key: 'E' },
]

export function Toolbar({ touch }: { touch: boolean }) {
  const tool = useStore((s) => s.tool.tool)
  const mode = useStore((s) => s.mode)
  const color = useStore((s) => s.tool.color)
  const size = useStore((s) => s.tool.sizes[s.tool.tool])
  const setTool = useStore((s) => s.setTool)
  const setMode = useStore((s) => s.setMode)
  const [popover, setPopover] = useState<'color' | 'brush' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popover) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopover(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [popover])

  const btn = touch ? 'h-14 w-14' : 'h-11 w-11'
  const iconSize = touch ? 26 : 22

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <Panel className="flex flex-col items-center gap-1 p-2">
        {TOOLS.map(({ type, Icon, label, key }) => (
          <IconButton
            key={type}
            className={btn}
            active={mode === 'draw' && tool === type}
            label={touch ? label : `${label} (${key})`}
            onClick={() => {
              setTool(type)
              setPopover(null)
            }}
          >
            <Icon width={iconSize} height={iconSize} />
          </IconButton>
        ))}

        <div className="my-1 h-px w-7 bg-white/10" />

        <IconButton
          className={btn}
          active={mode === 'select'}
          label={touch ? 'Select' : 'Select (V)'}
          onClick={() => {
            setMode(mode === 'select' ? 'draw' : 'select')
            setPopover(null)
          }}
        >
          <SelectIcon width={iconSize} height={iconSize} />
        </IconButton>

        <div className="my-1 h-px w-7 bg-white/10" />

        {/* Color swatch */}
        <button
          className={`${btn} flex items-center justify-center rounded-xl hover:bg-white/10`}
          title="Color"
          aria-label="Color"
          onClick={() => setPopover(popover === 'color' ? null : 'color')}
        >
          <span
            className="h-6 w-6 rounded-full ring-2 ring-white/30"
            style={{ background: color }}
          />
        </button>

        {/* Brush size / opacity */}
        <button
          className={`${btn} flex flex-col items-center justify-center rounded-xl hover:bg-white/10`}
          title="Brush settings"
          aria-label="Brush settings"
          onClick={() => setPopover(popover === 'brush' ? null : 'brush')}
        >
          <span
            className="rounded-full bg-white/90"
            style={{ width: Math.min(22, Math.max(3, size)), height: Math.min(22, Math.max(3, size)) }}
          />
          <span className="mt-1 font-mono text-[10px] text-white/50">{size}</span>
        </button>
      </Panel>

      {popover && (
        <div className="absolute left-full top-0 z-30 ml-3">
          <Panel>{popover === 'color' ? <ColorPicker /> : <BrushControls />}</Panel>
        </div>
      )}
    </div>
  )
}
