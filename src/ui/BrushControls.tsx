import { useStore } from '@/store/store'
import { BRUSH_PRESETS } from '@/engine/brushes/presets'

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-white/90">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sketch-slider w-full"
      />
    </div>
  )
}

export function BrushControls() {
  const tool = useStore((s) => s.tool.tool)
  const size = useStore((s) => s.tool.sizes[s.tool.tool])
  const opacity = useStore((s) => s.tool.opacities[s.tool.tool])
  const setSize = useStore((s) => s.setBrushSize)
  const setOpacity = useStore((s) => s.setBrushOpacity)
  const preset = BRUSH_PRESETS[tool]

  return (
    <div className="w-64 p-4">
      <div className="mb-3 text-xs uppercase tracking-wide text-white/40">{preset.label}</div>
      <Slider
        label="Size"
        value={size}
        min={preset.minSize}
        max={preset.maxSize}
        step={1}
        suffix="px"
        onChange={setSize}
      />
      <Slider
        label="Opacity"
        value={Math.round(opacity * 100)}
        min={5}
        max={100}
        step={1}
        suffix="%"
        onChange={(v) => setOpacity(v / 100)}
      />
      <div className="mt-4 flex items-center justify-center rounded-xl bg-black/30 py-4">
        <span
          className="rounded-full bg-white"
          style={{
            width: Math.min(64, Math.max(4, size)),
            height: Math.min(64, Math.max(4, size)),
            opacity,
          }}
        />
      </div>
    </div>
  )
}
