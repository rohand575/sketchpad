import Dexie, { type Table } from 'dexie'
import type { SketchDocument } from '@/model/types'

/** Lightweight index row for the document gallery (avoids loading full docs). */
export interface DocumentMeta {
  id: string
  title: string
  updatedAt: number
  createdAt: number
  /** data URL PNG thumbnail. */
  thumbnail?: string
}

class SketchpadDB extends Dexie {
  documents!: Table<SketchDocument, string>
  meta!: Table<DocumentMeta, string>

  constructor() {
    super('sketchpad')
    this.version(1).stores({
      documents: 'id, updatedAt',
      meta: 'id, updatedAt',
    })
  }
}

export const db = new SketchpadDB()

export async function saveDocument(doc: SketchDocument, thumbnail?: string): Promise<void> {
  await db.transaction('rw', db.documents, db.meta, async () => {
    await db.documents.put(doc)
    await db.meta.put({
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      thumbnail,
    })
  })
}

export async function loadDocument(id: string): Promise<SketchDocument | undefined> {
  return db.documents.get(id)
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  return db.meta.orderBy('updatedAt').reverse().toArray()
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', db.documents, db.meta, async () => {
    await db.documents.delete(id)
    await db.meta.delete(id)
  })
}

const LAST_DOC_KEY = 'sketchpad:lastDocId'

export function rememberLastDoc(id: string): void {
  try {
    localStorage.setItem(LAST_DOC_KEY, id)
  } catch {
    /* ignore quota/private-mode errors */
  }
}

export function getLastDocId(): string | null {
  try {
    return localStorage.getItem(LAST_DOC_KEY)
  } catch {
    return null
  }
}
