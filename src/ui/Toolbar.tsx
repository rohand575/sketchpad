import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { getBrush } from '@/engine/brushes/library'
import { IconButton, Panel } from './primitives'
import { ColorPicker } from './ColorPicker'
import { BrushControls } from './BrushControls'
import { BrushPanel } from './BrushPanel'
import { EraserIcon, PenIcon, SelectIcon } from './icons'

type Popover = 'brushes' | 'color' | 'brush' | null

export function Toolbar({
  touch,
  orientation = 'vertical',
}: {
  touch: boolean
  orientation?: 'vertical' | 'horizontal'
}) {
  const brushId = useStore((s) => s.tool.brushId)
  const mode = useStore((s) => s.mode)
  const color = useStore((s) => s.tool.color)
  const size = useStore((s) => s.tool.sizes[s.tool.brushId])
  const setBrush = useStore((s) => s.setBrush)
  const setMode = useStore((s) => s.setMode)
  const [popover, setPopover] = useState<Popover>(null)
  const ref = useRef<HTMLDivElement>(null)

  const brush = getBrush(brushId)
  const isEraser = brush.erase
  const drawing = mode === 'draw'

  useEffect(() => {
    if (!popover) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopover(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [popover])

  const horizontal = orientation === 'horizontal'
  const btn = horizontal ? 'h-12 w-12' : touch ? 'h-14 w-14' : 'h-11 w-11'
  const iconSize = horizontal ? 24 : touch ? 26 : 22
  const divider = horizontal ? 'mx-0.5 h-7 w-px bg-white/10' : 'my-1 h-px w-7 bg-white/10'
  const popoverPos = horizontal
    ? 'bottom-full left-1/2 mb-3 -translate-x-1/2'
    : 'left-full top-0 ml-3'

  const toggle = (p: Popover) => setPopover((cur) => (cur === p ? null : p))

  return (
    <div ref={ref} className="pointer-events-auto relative">
      <Panel
        className={
          (horizontal
            ? 'flex flex-row items-center gap-1 p-1.5'
            : 'flex flex-col items-center gap-1 p-2') +
          (horizontal ? ' max-w-[96vw] overflow-x-auto' : '')
        }
      >
        <IconButton
          className={`${btn} shrink-0`}
          active={drawing && !isEraser}
          label="Brushes"
          onClick={() => {
            if (isEraser) setBrush('studio-pen')
            else setMode('draw')
            toggle('brushes')
          }}
        >
          <PenIcon width={iconSize} height={iconSize} />
        </IconButton>

        <IconButton
          className={`${btn} shrink-0`}
          active={drawing && isEraser}
          label="Eraser"
          onClick={() => {
            setBrush('eraser-hard')
            setPopover(null)
          }}
        >
          <EraserIcon width={iconSize} height={iconSize} />
        </IconButton>

        <div className={divider} />

        <IconButton
          className={`${btn} shrink-0`}
          active={mode === 'select'}
          label={touch ? 'Select' : 'Select (V)'}
          onClick={() => {
            setMode(mode === 'select' ? 'draw' : 'select')
            setPopover(null)
          }}
        >
          <SelectIcon width={iconSize} height={iconSize} />
        </IconButton>

        <div className={divider} />

        <button
          className={`${btn} flex shrink-0 items-center justify-center rounded-xl hover:bg-white/10`}
          title="Color"
          aria-label="Color"
          onClick={() => toggle('color')}
        >
          <span className="h-6 w-6 rounded-full ring-2 ring-white/30" style={{ background: color }} />
        </button>

        <button
          className={`${btn} flex shrink-0 flex-col items-center justify-center rounded-xl hover:bg-white/10`}
          title="Brush settings"
          aria-label="Brush settings"
          onClick={() => toggle('brush')}
        >
          <span
            className="rounded-full bg-white/90"
            style={{
              width: Math.min(22, Math.max(3, size)),
              height: Math.min(22, Math.max(3, size)),
            }}
          />
          <span className="mt-0.5 font-mono text-[10px] text-white/50">{Math.round(size)}</span>
        </button>
      </Panel>

      {popover && (
        <div className={`absolute z-30 ${popoverPos}`}>
          <Panel>
            {popover === 'brushes' ? (
              <BrushPanel onPick={() => setPopover(null)} />
            ) : popover === 'color' ? (
              <ColorPicker />
            ) : (
              <BrushControls />
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
