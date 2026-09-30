import { create } from 'zustand'
import {
  produceWithPatches,
  applyPatches,
  enablePatches,
  type Patch,
} from 'immer'
import type { Element, Layer, SketchDocument, Camera } from '@/model/types'
import { BRUSHES, DEFAULT_BRUSH_ID } from '@/engine/brushes/library'
import { createDocument, createLayer, migrateDocument } from '@/model/factory'

enablePatches()

const HISTORY_LIMIT = 200

interface HistoryEntry {
  patches: Patch[]
  inverse: Patch[]
}

interface ToolState {
  brushId: string
  color: string
  recentColors: string[]
  sizes: Record<string, number>
  opacities: Record<string, number>
}

export interface StoreState {
  doc: SketchDocument
  activeLayerId: string
  tool: ToolState
  /** 'draw' uses brushes; 'select' enables the selection/transform tool. */
  mode: 'draw' | 'select'
  /** Ids of currently selected elements (UI state; not undoable). */
  selectedIds: string[]
  /** Per-layer version counter; bumped whenever that layer's content changes. */
  layerVersion: Record<string, number>
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Bumps whenever the document is persisted, so autosave can debounce cleanly. */
  dirty: boolean

  // --- mode & selection (not undoable) ---
  setMode: (mode: 'draw' | 'select') => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  deleteSelection: () => void

  // --- live transform (single undoable step per gesture) ---
  beginInteraction: () => void
  previewElements: (elements: Element[]) => void
  endInteraction: () => void

  // --- tool actions (not undoable) ---
  setBrush: (brushId: string) => void
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
  const sizes: Record<string, number> = {}
  const opacities: Record<string, number> = {}
  BRUSHES.forEach((b) => {
    sizes[b.id] = b.size
    opacities[b.id] = b.opacity
  })
  return {
    brushId: DEFAULT_BRUSH_ID,
    color: '#111827',
    recentColors: ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b'],
    sizes,
    opacities,
  }
}

export const useStore = create<StoreState>((set, get) => {
  // Snapshot of elements captured at the start of a transform gesture, so the
  // whole gesture collapses into one undoable step on release.
  let interactionBaseline: Element[] | null = null

  const bumpAll = (base: Record<string, number>, doc: SketchDocument) => {
    const next = { ...base }
    doc.layers.forEach((l) => (next[l.id] = (next[l.id] ?? 0) + 1))
    return next
  }

  /**
   * Apply an undoable recipe to `doc`, recording inverse patches for undo.
   * `affected` limits which layer caches are invalidated (defaults to all) —
   * bumping only the drawn layer keeps the WebGL engine from re-baking every
   * layer on each stroke.
   */
  const commit = (recipe: (draft: SketchDocument) => void, affected?: string[]) => {
    const state = get()
    const [nextDoc, patches, inverse] = produceWithPatches(state.doc, (draft) => {
      recipe(draft)
      draft.updatedAt = Date.now()
    })
    if (patches.length === 0) return

    const layerVersion = { ...state.layerVersion }
    const layers = affected ?? nextDoc.layers.map((l) => l.id)
    for (const id of layers) {
      layerVersion[id] = (layerVersion[id] ?? 0) + 1
    }

    const past = [...state.past, { patches, inverse }]
    if (past.length > HISTORY_LIMIT) past.shift()

    set({ doc: nextDoc, past, future: [], layerVersion, dirty: true })
  }

  return {
    doc: createDocument(),
    activeLayerId: '',
    tool: defaultTool(),
    mode: 'draw',
    selectedIds: [],
    layerVersion: {},
    past: [],
    future: [],
    dirty: false,

    setMode: (mode) => set((s) => ({ mode, selectedIds: mode === 'draw' ? [] : s.selectedIds })),
    setSelection: (ids) => set({ selectedIds: ids }),
    clearSelection: () => set({ selectedIds: [] }),
    deleteSelection: () => {
      const ids = get().selectedIds
      if (ids.length === 0) return
      const idset = new Set(ids)
      commit((d) => {
        d.elements = d.elements.filter((e) => !idset.has(e.id))
      })
      set({ selectedIds: [] })
    },

    beginInteraction: () => {
      interactionBaseline = get().doc.elements
    },
    previewElements: (elements) =>
      set((s) => ({
        doc: { ...s.doc, elements, updatedAt: Date.now() },
        layerVersion: bumpAll(s.layerVersion, s.doc),
        dirty: true,
      })),
    endInteraction: () => {
      const baseline = interactionBaseline
      interactionBaseline = null
      if (!baseline) return
      const current = get().doc.elements
      if (current === baseline) return
      const patches = [{ op: 'replace' as const, path: ['elements'], value: current }]
      const inverse = [{ op: 'replace' as const, path: ['elements'], value: baseline }]
      const past = [...get().past, { patches, inverse }]
      if (past.length > HISTORY_LIMIT) past.shift()
      set({ past, future: [] })
    },

    setBrush: (brushId) =>
      set((s) => ({ tool: { ...s.tool, brushId }, mode: 'draw', selectedIds: [] })),
    setColor: (color) =>
      set((s) => {
        const recent = [color, ...s.tool.recentColors.filter((c) => c !== color)].slice(0, 8)
        return { tool: { ...s.tool, color, recentColors: recent } }
      }),
    setBrushSize: (size) =>
      set((s) => ({ tool: { ...s.tool, sizes: { ...s.tool.sizes, [s.tool.brushId]: size } } })),
    setBrushOpacity: (opacity) =>
      set((s) => ({
        tool: { ...s.tool, opacities: { ...s.tool.opacities, [s.tool.brushId]: opacity } },
      })),
    activeSize: () => {
      const s = get()
      return s.tool.sizes[s.tool.brushId]
    },
    activeOpacity: () => {
      const s = get()
      return s.tool.opacities[s.tool.brushId]
    },

    setCamera: (camera) =>
      set((s) => ({ doc: { ...s.doc, camera } })),

    addElement: (element) => commit((d) => void d.elements.push(element), [element.layerId]),
    removeElements: (ids) => {
      const idset = new Set(ids)
      const affected = [
        ...new Set(get().doc.elements.filter((e) => idset.has(e.id)).map((e) => e.layerId)),
      ]
      commit((d) => {
        d.elements = d.elements.filter((e) => !idset.has(e.id))
      }, affected)
    },
    updateElement: (id, patch) => {
      const el = get().doc.elements.find((e) => e.id === id)
      commit((d) => {
        const target = d.elements.find((e) => e.id === id)
        if (target) Object.assign(target, patch)
      }, el ? [el.layerId] : undefined)
    },

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

    loadDocument: (raw) => {
      const doc = migrateDocument(raw)
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
        selectedIds: [],
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
