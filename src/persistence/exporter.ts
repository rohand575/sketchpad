import type { SketchDocument } from '@/model/types'
import { Canvas2DRenderer } from '@/engine/renderer/canvas2d'
import { WebGLRenderer, isWebGL2Available } from '@/engine/gl/WebGLRenderer'

export type ExportFormat = 'png' | 'jpeg'

// A single offscreen WebGL renderer reused for high-quality exports (browsers
// cap the number of live GL contexts, so we don't create one per export).
let sharedGL: WebGLRenderer | null = null
function glExporter(): WebGLRenderer | null {
  if (!isWebGL2Available()) return null
  if (sharedGL) return sharedGL
  try {
    const canvas = document.createElement('canvas')
    const r = new WebGLRenderer()
    r.attach(canvas)
    sharedGL = r
    return r
  } catch {
    return null
  }
}

const c2d = new Canvas2DRenderer()

/** Full-fidelity raster of the document (textured, GL when available). */
function renderDoc(doc: SketchDocument, scale: number): HTMLCanvasElement {
  const gl = glExporter()
  if (gl) {
    try {
      return gl.exportToCanvas(doc, scale)
    } catch {
      /* fall back */
    }
  }
  return c2d.exportToCanvas(doc, scale)
}

/** Rasterize the document and trigger a file download. */
export async function exportImage(
  doc: SketchDocument,
  format: ExportFormat = 'png',
  scale = 1,
): Promise<void> {
  const canvas = renderDoc(doc, scale)
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.92),
  )
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitize(doc.title)}.${format === 'png' ? 'png' : 'jpg'}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Small PNG thumbnail (data URL) for the gallery. Uses the cheap Canvas2D path
 * (flat strokes are fine for a preview) to avoid a full GL re-bake on every save.
 */
export function makeThumbnail(doc: SketchDocument, maxSize = 320): string {
  const scale = Math.min(maxSize / doc.width, maxSize / doc.height, 1)
  const full = c2d.exportToCanvas(doc, scale)
  return full.toDataURL('image/png')
}

/** Export the raw vector document as JSON (re-importable, lossless). */
export function exportJSON(doc: SketchDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitize(doc.title)}.sketchpad.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function sanitize(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim() || 'sketch'
}
