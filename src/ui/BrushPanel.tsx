import { useStore } from '@/store/store'
import { brushesByCategory, type Brush } from '@/engine/brushes/library'

const CATEGORY_LABEL: Record<string, string> = {
  ink: 'Inking',
  pencil: 'Pencils',
  paint: 'Painting',
  airbrush: 'Airbrush',
  marker: 'Markers',
  eraser: 'Erasers',
}

function Preview({ brush }: { brush: Brush }) {
  // A tiny visual hint of the brush's softness/size.
  const soft = brush.shape === 'soft'
  return (
    <span
      className="inline-block h-4 w-8 rounded-full"
      style={{
        background: soft
          ? 'radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0))'
          : 'rgba(255,255,255,0.9)',
        opacity: brush.opacity,
      }}
    />
  )
}

export function BrushPanel({ onPick }: { onPick?: () => void }) {
  const brushId = useStore((s) => s.tool.brushId)
  const setBrush = useStore((s) => s.setBrush)
  const groups = brushesByCategory()

  return (
    <div className="max-h-[70vh] w-64 overflow-y-auto p-2">
      {groups.map((g) => (
        <div key={g.category} className="mb-2 last:mb-0">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-white/40">
            {CATEGORY_LABEL[g.category] ?? g.category}
          </div>
          {g.brushes.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBrush(b.id)
                onPick?.()
              }}
              className={
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ' +
                (brushId === b.id ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/5')
              }
            >
              <span className="flex h-4 w-8 items-center justify-center">
                <Preview brush={b} />
              </span>
              <span className="text-sm text-white/90">{b.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
