import { useStore } from '@/store/store'
import { IconButton, Panel } from './primitives'
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from './icons'

export function LayersPanel({ onClose }: { onClose: () => void }) {
  const layers = useStore((s) => s.doc.layers)
  const activeLayerId = useStore((s) => s.activeLayerId)
  const setActiveLayer = useStore((s) => s.setActiveLayer)
  const addLayer = useStore((s) => s.addLayer)
  const removeLayer = useStore((s) => s.removeLayer)
  const updateLayer = useStore((s) => s.updateLayer)
  const reorderLayer = useStore((s) => s.reorderLayer)

  // Top layer (highest order) shown first.
  const ordered = [...layers].sort((a, b) => b.order - a.order)

  return (
    <Panel className="flex w-72 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-white/80">Layers</span>
        <div className="flex items-center gap-1">
          <IconButton className="h-8 w-8" label="Add layer" onClick={addLayer}>
            <PlusIcon width={18} height={18} />
          </IconButton>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-white/50 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-2">
        {ordered.map((layer, idx) => {
          const isActive = layer.id === activeLayerId
          return (
            <div
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={
                'mb-1 flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ' +
                (isActive ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-white/5')
              }
            >
              <IconButton
                className="h-8 w-8"
                label={layer.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation()
                  updateLayer(layer.id, { visible: !layer.visible })
                }}
              >
                {layer.visible ? (
                  <EyeIcon width={16} height={16} />
                ) : (
                  <EyeOffIcon width={16} height={16} />
                )}
              </IconButton>

              <div className="min-w-0 flex-1">
                <input
                  value={layer.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                  className="w-full truncate bg-transparent text-sm text-white/90 outline-none focus:text-white"
                />
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(layer.opacity * 100)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateLayer(layer.id, { opacity: Number(e.target.value) / 100 })
                    }
                    className="sketch-slider h-1 flex-1"
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-white/40">
                    {Math.round(layer.opacity * 100)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <button
                  className="px-1 text-white/40 hover:text-white disabled:opacity-20"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    reorderLayer(layer.id, layer.order + 1)
                  }}
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  className="px-1 text-white/40 hover:text-white disabled:opacity-20"
                  disabled={idx === ordered.length - 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    reorderLayer(layer.id, layer.order - 1)
                  }}
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              <IconButton
                className="h-8 w-8"
                label="Delete layer"
                disabled={layers.length <= 1}
                onClick={(e) => {
                  e.stopPropagation()
                  removeLayer(layer.id)
                }}
              >
                <TrashIcon width={16} height={16} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
