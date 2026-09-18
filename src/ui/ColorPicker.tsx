import { useStore } from '@/store/store'

const SWATCHES = [
  '#111827', '#374151', '#6b7280', '#9ca3af', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

export function ColorPicker() {
  const color = useStore((s) => s.tool.color)
  const recent = useStore((s) => s.tool.recentColors)
  const setColor = useStore((s) => s.setColor)

  return (
    <div className="w-64 p-4">
      <div className="mb-3 flex items-center gap-3">
        <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-white/20">
          <span className="absolute inset-0" style={{ background: color }} />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="absolute -inset-2 cursor-pointer opacity-0"
          />
        </label>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-white/40">Color</div>
          <div className="font-mono text-sm text-white/90">{color.toUpperCase()}</div>
        </div>
      </div>

      <div className="mb-1 text-xs uppercase tracking-wide text-white/40">Palette</div>
      <div className="grid grid-cols-5 gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={
              'h-9 w-9 rounded-lg ring-1 ring-inset ring-white/10 transition-transform hover:scale-105 ' +
              (color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-white/70' : '')
            }
            style={{ background: c }}
            aria-label={c}
          />
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div className="mb-1 mt-4 text-xs uppercase tracking-wide text-white/40">Recent</div>
          <div className="flex flex-wrap gap-2">
            {recent.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-md ring-1 ring-inset ring-white/10 hover:scale-105"
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
