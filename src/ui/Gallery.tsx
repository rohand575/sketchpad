import { useEffect, useState } from 'react'
import { useStore } from '@/store/store'
import {
  deleteDocument,
  listDocuments,
  loadDocument,
  rememberLastDoc,
  saveDocument,
  type DocumentMeta,
} from '@/persistence/db'
import { createDocument } from '@/model/factory'
import { Panel } from './primitives'
import { PlusIcon, TrashIcon } from './icons'

export function Gallery({ onClose }: { onClose: () => void }) {
  const [docs, setDocs] = useState<DocumentMeta[]>([])
  const loadDoc = useStore((s) => s.loadDocument)
  const currentId = useStore((s) => s.doc.id)

  const refresh = () => listDocuments().then(setDocs)
  useEffect(() => {
    refresh()
  }, [])

  const openDoc = async (id: string) => {
    if (id === currentId) {
      onClose()
      return
    }
    const doc = await loadDocument(id)
    if (doc) {
      loadDoc(doc)
      rememberLastDoc(doc.id)
      onClose()
    }
  }

  const newDoc = async () => {
    const doc = createDocument()
    await saveDocument(doc)
    loadDoc(doc)
    rememberLastDoc(doc.id)
    onClose()
  }

  const remove = async (id: string) => {
    await deleteDocument(id)
    if (id === currentId) {
      const remaining = await listDocuments()
      const next = remaining[0]
      if (next) {
        const doc = await loadDocument(next.id)
        if (doc) loadDoc(doc)
      } else {
        await newDoc()
        return
      }
    }
    refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <Panel className="flex max-h-[85vh] w-full max-w-4xl flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h1 className="text-lg font-semibold text-white/90">Your sketches</h1>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3 md:grid-cols-4">
          <button
            onClick={newDoc}
            className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-white/50 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white"
          >
            <PlusIcon width={32} height={32} />
            <span className="text-sm">New sketch</span>
          </button>

          {docs.map((d) => (
            <div
              key={d.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30"
            >
              <button
                onClick={() => openDoc(d.id)}
                className="block w-full text-left"
              >
                <div className="aspect-[4/3] w-full bg-white/5">
                  {d.thumbnail ? (
                    <img
                      src={d.thumbnail}
                      alt={d.title}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/20">
                      empty
                    </div>
                  )}
                </div>
                <div className="px-3 py-2">
                  <div className="truncate text-sm text-white/90">{d.title || 'Untitled'}</div>
                  <div className="text-xs text-white/40">
                    {new Date(d.updatedAt).toLocaleString()}
                  </div>
                </div>
              </button>
              <button
                onClick={() => remove(d.id)}
                className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white/60 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                title="Delete"
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
