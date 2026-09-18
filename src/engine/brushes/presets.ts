import type { BrushType } from '@/model/types'
import type { StrokeOptions } from 'perfect-freehand'

export interface BrushPreset {
  type: BrushType
  label: string
  /** Default diameter in world units. */
  defaultSize: number
  minSize: number
  maxSize: number
  /** Default opacity 0..1. */
  defaultOpacity: number
  /** Canvas globalCompositeOperation used when rasterizing onto a layer. */
  composite: GlobalCompositeOperation
  /** Whether this brush uses pressure to modulate width. */
  pressure: boolean
  /** perfect-freehand options (size is injected per-stroke). */
  freehand: Omit<StrokeOptions, 'size'>
}

// Each brush maps to concrete rendering parameters. Kept declarative so new
// brushes are a data change, not a code change.
export const BRUSH_PRESETS: Record<BrushType, BrushPreset> = {
  pen: {
    type: 'pen',
    label: 'Pen',
    defaultSize: 6,
    minSize: 1,
    maxSize: 80,
    defaultOpacity: 1,
    composite: 'source-over',
    pressure: true,
    freehand: {
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t) => t,
      simulatePressure: true,
    },
  },
  pencil: {
    type: 'pencil',
    label: 'Pencil',
    defaultSize: 4,
    minSize: 1,
    maxSize: 40,
    defaultOpacity: 0.85,
    composite: 'source-over',
    pressure: true,
    freehand: {
      thinning: 0.75,
      smoothing: 0.4,
      streamline: 0.35,
      easing: (t) => Math.sin((t * Math.PI) / 2),
      simulatePressure: true,
    },
  },
  marker: {
    type: 'marker',
    label: 'Marker',
    defaultSize: 22,
    minSize: 4,
    maxSize: 120,
    defaultOpacity: 0.4,
    // multiply gives the translucent, layering highlighter feel
    composite: 'multiply',
    pressure: false,
    freehand: {
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.55,
      easing: (t) => t,
      simulatePressure: false,
    },
  },
  eraser: {
    type: 'eraser',
    label: 'Eraser',
    defaultSize: 24,
    minSize: 2,
    maxSize: 200,
    defaultOpacity: 1,
    // destination-out cuts pixels from the layer bitmap
    composite: 'destination-out',
    pressure: true,
    freehand: {
      thinning: 0.3,
      smoothing: 0.5,
      streamline: 0.5,
      easing: (t) => t,
      simulatePressure: true,
    },
  },
}
