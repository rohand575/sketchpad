import { create } from 'zustand'
import {
  produceWithPatches,
  applyPatches,
  enablePatches,
  type Patch,
} from 'immer'
import type { BrushType, Element, Layer, SketchDocument, Camera } from '@/model/types'
import { BRUSH_PRESETS } from '@/engine/brushes/presets'
import { createDocument, createLayer } from '@/model/factory'

enablePatches()

const HISTORY_LIMIT = 200

interface HistoryEntry {
  patches: Patch[]
  inverse: Patch[]
}

interface ToolState {
  tool: BrushType
  color: string
  recentColors: string[]
  sizes: Record<BrushType, number>
  opacities: Record<BrushType, number>
}

export interface StoreState {
  doc: SketchDocument
  activeLayerId: string
  tool: ToolState
  /** Per-layer version counter; bumped whenever that layer's content changes. */
  layerVersion: Record<string, number>
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Bumps whenever the document is persisted, so autosave can debounce cleanly. */
  dirty: boolean

  // --- tool actions (not undoable) ---
  setTool: (tool: BrushType) => void
  setColor: (color: string) => void
  setBrushSize: (size: number) => void
  setBrushOpacity: (opacity: number) => void
  activeSize: () => number
  activeOpacity: () => number

  // --- camera (not undoable) ---
  setCamera: (camera: Camera) => void

  // --- document mutations (undoable) ---
  addElement: (element: Element) => void
  removeElements: (ids: string[]) => void
  updateElement: (id: string, patch: Partial<Element>) => void
  setActiveLayer: (layerId: string) => void
  addLayer: () => void
  removeLayer: (layerId: string) => void
  updateLayer: (layerId: string, patch: Partial<Layer>) => void
  reorderLayer: (layerId: string, targetOrder: number) => void
  setTitle: (title: string) => void
  setBackground: (color: string) => void
  clearActiveLayer: () => void

  // --- history ---
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // --- lifecycle ---
  loadDocument: (doc: SketchDocument) => void
  newDocument: () => void
  markSaved: () => void
}

function defaultTool(): ToolState {
  const sizes = {} as Record<BrushType, number>
  const opacities = {} as Record<BrushType, number>
  ;(Object.keys(BRUSH_PRESETS) as BrushType[]).forEach((t) => {
    sizes[t] = BRUSH_PRESETS[t].defaultSize
    opacities[t] = BRUSH_PRESETS[t].defaultOpacity
  })
  return {
    tool: 'pen',
    color: '#111827',
    recentColors: ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'],
    sizes,
    opacities,
  }
}

/** Which layers a set of patches touched (so the renderer can invalidate caches). */
function touchedLayers(doc: SketchDocument, patches: Patch[]): Set<string> {
  const layers = new Set<string>()
  for (const p of patches) {
    if (p.path[0] === 'elements') {
      // We can't cheaply resolve which element/layer without scanning; bump all.
      doc.layers.forEach((l) => layers.add(l.id))
      break
    }
  }
  return layers
}

export const useStore = create<StoreState>((set, get) => {
  /** Apply an undoable recipe to `doc`, recording inverse patches for undo. */
  const commit = (recipe: (draft: SketchDocument) => void, bumpAllLayers = true) => {
    const state = get()
    const [nextDoc, patches, inverse] = produceWithPatches(state.doc, (draft) => {
      recipe(draft)
      draft.updatedAt = Date.now()
    })
    if (patches.length === 0) return

    const layerVersion = { ...state.layerVersion }
    const layers = bumpAllLayers
      ? new Set(nextDoc.layers.map((l) => l.id))
      : touchedLayers(nextDoc, patches)
    layers.forEach((id) => {
      layerVersion[id] = (layerVersion[id] ?? 0) + 1
    })

    const past = [...state.past, { patches, inverse }]
    if (past.length > HISTORY_LIMIT) past.shift()

    set({ doc: nextDoc, past, future: [], layerVersion, dirty: true })
  }

  return {
    doc: createDocument(),
    activeLayerId: '',
    tool: defaultTool(),
    layerVersion: {},
    past: [],
    future: [],
    dirty: false,

    setTool: (tool) => set((s) => ({ tool: { ...s.tool, tool } })),
    setColor: (color) =>
      set((s) => {
        const recent = [color, ...s.tool.recentColors.filter((c) => c !== color)].slice(0, 8)
        return { tool: { ...s.tool, color, recentColors: recent } }
      }),
    setBrushSize: (size) =>
      set((s) => ({ tool: { ...s.tool, sizes: { ...s.tool.sizes, [s.tool.tool]: size } } })),
    setBrushOpacity: (opacity) =>
      set((s) => ({
        tool: { ...s.tool, opacities: { ...s.tool.opacities, [s.tool.tool]: opacity } },
      })),
    activeSize: () => {
      const s = get()
      return s.tool.sizes[s.tool.tool]
    },
    activeOpacity: () => {
      const s = get()
      return s.tool.opacities[s.tool.tool]
    },

    setCamera: (camera) =>
      set((s) => ({ doc: { ...s.doc, camera } })),

    addElement: (element) => commit((d) => void d.elements.push(element)),
    removeElements: (ids) =>
      commit((d) => {
        const set2 = new Set(ids)
        d.elements = d.elements.filter((e) => !set2.has(e.id))
      }),
    updateElement: (id, patch) =>
      commit((d) => {
        const el = d.elements.find((e) => e.id === id)
        if (el) Object.assign(el, patch)
      }),

    setActiveLayer: (layerId) => set({ activeLayerId: layerId }),

    addLayer: () =>
      commit((d) => {
        const order = d.layers.length
        const layer = createLayer(order)
        d.layers.push(layer)
        // select the new layer after commit
        setTimeout(() => set({ activeLayerId: layer.id }), 0)
      }),

    removeLayer: (layerId) =>
      commit((d) => {
        if (d.layers.length <= 1) return
        d.layers = d.layers.filter((l) => l.id !== layerId)
        d.elements = d.elements.filter((e) => e.layerId !== layerId)
        d.layers.forEach((l, i) => (l.order = i))
        const current = get().activeLayerId
        if (current === layerId) {
          const top = d.layers[d.layers.length - 1]
          setTimeout(() => set({ activeLayerId: top.id }), 0)
        }
      }),

    updateLayer: (layerId, patch) =>
      commit((d) => {
        const layer = d.layers.find((l) => l.id === layerId)
        if (layer) Object.assign(layer, patch)
      }),

    reorderLayer: (layerId, targetOrder) =>
      commit((d) => {
        const sorted = [...d.layers].sort((a, b) => a.order - b.order)
        const from = sorted.findIndex((l) => l.id === layerId)
        if (from === -1) return
        const [moved] = sorted.splice(from, 1)
        const clamped = Math.max(0, Math.min(targetOrder, sorted.length))
        sorted.splice(clamped, 0, moved)
        sorted.forEach((l, i) => {
          const target = d.layers.find((x) => x.id === l.id)!
          target.order = i
        })
      }),

    setTitle: (title) => commit((d) => void (d.title = title)),
    setBackground: (color) => commit((d) => void (d.background = color)),
    clearActiveLayer: () => {
      const active = get().activeLayerId
      commit((d) => {
        d.elements = d.elements.filter((e) => e.layerId !== active)
      })
    },

    undo: () => {
      const state = get()
      const entry = state.past[state.past.length - 1]
      if (!entry) return
      const nextDoc = applyPatches(state.doc, entry.inverse)
      const layerVersion = { ...state.layerVersion }
      nextDoc.layers.forEach((l) => (layerVersion[l.id] = (layerVersion[l.id] ?? 0) + 1))
      set({
        doc: nextDoc,
        past: state.past.slice(0, -1),
        future: [entry, ...state.future],
        layerVersion,
        dirty: true,
      })
    },
    redo: () => {
      const state = get()
      const entry = state.future[0]
      if (!entry) return
      const nextDoc = applyPatches(state.doc, entry.patches)
      const layerVersion = { ...state.layerVersion }
      nextDoc.layers.forEach((l) => (layerVersion[l.id] = (layerVersion[l.id] ?? 0) + 1))
      set({
        doc: nextDoc,
        past: [...state.past, entry],
        future: state.future.slice(1),
        layerVersion,
        dirty: true,
      })
    },
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    loadDocument: (doc) => {
      const layerVersion: Record<string, number> = {}
      doc.layers.forEach((l) => (layerVersion[l.id] = 0))
      const sorted = [...doc.layers].sort((a, b) => a.order - b.order)
      const topLayer = sorted[sorted.length - 1]
      set({
        doc,
        activeLayerId: topLayer?.id ?? '',
        layerVersion,
        past: [],
        future: [],
        dirty: false,
      })
    },
    newDocument: () => {
      const doc = createDocument()
      get().loadDocument(doc)
    },
    markSaved: () => set({ dirty: false }),
  }
})

// Ensure an active layer is always selected on first load.
if (!useStore.getState().activeLayerId) {
  const { doc } = useStore.getState()
  useStore.setState({ activeLayerId: doc.layers[0]?.id ?? '' })
}
