import type { SketchDocument } from '@/model/types'
import { Canvas2DRenderer } from '@/engine/renderer/canvas2d'

const renderer = new Canvas2DRenderer()

export type ExportFormat = 'png' | 'jpeg'

/** Rasterize the document and trigger a file download. */
export async function exportImage(
  doc: SketchDocument,
  format: ExportFormat = 'png',
  scale = 2,
): Promise<void> {
  const canvas = renderer.exportToCanvas(doc, scale)
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

/** Small PNG thumbnail (data URL) for the document gallery. */
export function makeThumbnail(doc: SketchDocument, maxSize = 320): string {
  const full = renderer.exportToCanvas(doc, 1)
  const ratio = Math.min(maxSize / full.width, maxSize / full.height, 1)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(full.width * ratio))
  out.height = Math.max(1, Math.round(full.height * ratio))
  const ctx = out.getContext('2d')!
  ctx.drawImage(full, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
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
