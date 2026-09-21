// Cloud sync engine. Loaded lazily (only after a user signs in), so the
// firebase/firestore SDK never enters the local-only bundle.
//
// Model in Firestore:
//   users/{uid}/documents/{docId}                -> meta (title, layers, camera, updatedAt)
//   users/{uid}/documents/{docId}/elements/{id}  -> one doc per element (vector stroke)
//
// Strategy: local-first. Dexie is the working store; we push element/meta
// deltas (debounced) and listen to the open doc's meta. When a remote copy is
// newer (last-write-wins by updatedAt) we pull the full document. This delivers
// the "start on laptop, continue on tablet" handoff without real-time CRDT
// complexity (concurrent live co-editing is a later concern).

import {
  collection,
  doc as fsDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Element, SketchDocument } from '@/model/types'
import { useStore } from '@/store/store'
import { listDocuments, loadDocument as loadLocalDoc, saveDocument } from '@/persistence/db'
import { makeThumbnail } from '@/persistence/exporter'
import { getFirebase } from './firebase'
import { setSyncStatus as setStatus } from './cloudStatus'

interface RemoteMeta {
  docId: string
  title: string
  background: string
  camera: SketchDocument['camera']
  layers: SketchDocument['layers']
  createdAt: number
  updatedAt: number
  version: number
  ownerId: string
}

function metaFrom(doc: SketchDocument, uid: string): RemoteMeta {
  return {
    docId: doc.id,
    title: doc.title,
    background: doc.background,
    camera: doc.camera,
    layers: doc.layers,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
    ownerId: uid,
  }
}

function safeThumb(doc: SketchDocument): string | undefined {
  try {
    return makeThumbnail(doc)
  } catch {
    return undefined
  }
}

const CHUNK = 400
const PUSH_DEBOUNCE = 900

class SyncEngine {
  private uid: string | null = null
  private currentDocId: string | null = null
  private lastPushed = new Map<string, Element>()
  private applyingRemote = false
  private pushTimer: number | null = null
  private unsubMeta: (() => void) | null = null
  private unsubStore: (() => void) | null = null

  async start(uid: string): Promise<void> {
    if (this.uid === uid) return
    this.uid = uid
    try {
      await this.reconcileLibrary()
    } catch {
      setStatus('error')
    }
    this.attachToOpenDoc()
    this.unsubStore = useStore.subscribe((s, prev) => {
      if (!this.uid) return
      if (s.doc.id !== prev.doc.id) {
        this.attachToOpenDoc()
        return
      }
      if (this.applyingRemote) return
      if (s.doc !== prev.doc) this.schedulePush()
    })
  }

  stop(): void {
    this.uid = null
    this.currentDocId = null
    this.lastPushed.clear()
    if (this.pushTimer) window.clearTimeout(this.pushTimer)
    this.pushTimer = null
    this.unsubMeta?.()
    this.unsubMeta = null
    this.unsubStore?.()
    this.unsubStore = null
    setStatus('idle')
  }

  private paths(uid: string, docId: string) {
    return {
      elements: (db: import('firebase/firestore').Firestore) =>
        collection(db, 'users', uid, 'documents', docId, 'elements'),
      meta: (db: import('firebase/firestore').Firestore) =>
        fsDoc(db, 'users', uid, 'documents', docId),
      element: (db: import('firebase/firestore').Firestore, id: string) =>
        fsDoc(db, 'users', uid, 'documents', docId, 'elements', id),
    }
  }

  private attachToOpenDoc(): void {
    const doc = useStore.getState().doc
    this.currentDocId = doc.id
    // Baseline = current local elements (reconcile has already merged), so we
    // only push subsequent deltas, not the whole document.
    this.lastPushed = new Map(doc.elements.map((e) => [e.id, e]))
    this.bindMeta()
    this.schedulePush() // ensures the remote meta doc exists / is current
  }

  private async bindMeta(): Promise<void> {
    this.unsubMeta?.()
    this.unsubMeta = null
    const fb = await getFirebase()
    if (!fb || !this.uid || !this.currentDocId) return
    const uid = this.uid
    const docId = this.currentDocId
    this.unsubMeta = onSnapshot(this.paths(uid, docId).meta(fb.db), (snap) => {
      if (!snap.exists()) return
      const remote = snap.data() as RemoteMeta
      const local = useStore.getState().doc
      if (remote.docId !== local.id) return
      // Last-write-wins: only adopt a strictly newer remote copy.
      if ((remote.updatedAt ?? 0) <= local.updatedAt) return
      this.pullFullDoc(local.id, remote)
    })
  }

  private schedulePush(): void {
    if (this.pushTimer) window.clearTimeout(this.pushTimer)
    this.pushTimer = window.setTimeout(() => this.pushNow(), PUSH_DEBOUNCE)
  }

  private async pushNow(): Promise<void> {
    const fb = await getFirebase()
    if (!fb || !this.uid) return
    const uid = this.uid
    const doc = useStore.getState().doc
    if (doc.id !== this.currentDocId) return
    setStatus('syncing')
    try {
      const p = this.paths(uid, doc.id)
      const current = new Map(doc.elements.map((e) => [e.id, e]))
      const writes: { type: 'set' | 'del'; id: string; el?: Element }[] = []
      for (const [id, el] of current) {
        if (this.lastPushed.get(id) !== el) writes.push({ type: 'set', id, el })
      }
      for (const id of this.lastPushed.keys()) {
        if (!current.has(id)) writes.push({ type: 'del', id })
      }
      for (let i = 0; i < writes.length; i += CHUNK) {
        const batch = writeBatch(fb.db)
        for (const w of writes.slice(i, i + CHUNK)) {
          const ref = p.element(fb.db, w.id)
          if (w.type === 'set') batch.set(ref, w.el as unknown as Record<string, unknown>)
          else batch.delete(ref)
        }
        await batch.commit()
      }
      await setDoc(p.meta(fb.db), metaFrom(doc, uid))
      this.lastPushed = current
      setStatus('synced')
    } catch {
      setStatus('error')
    }
  }

  private async pullFullDoc(docId: string, remote: RemoteMeta): Promise<void> {
    const fb = await getFirebase()
    if (!fb || !this.uid) return
    setStatus('syncing')
    try {
      const snap = await getDocs(this.paths(this.uid, docId).elements(fb.db))
      const elements = snap.docs.map((d) => d.data() as Element)
      const rebuilt: SketchDocument = {
        id: docId,
        title: remote.title,
        createdAt: remote.createdAt,
        updatedAt: remote.updatedAt,
        background: remote.background,
        camera: remote.camera,
        layers: remote.layers,
        elements,
        version: remote.version,
        ownerId: this.uid,
      }
      this.applyingRemote = true
      useStore.getState().loadDocument(rebuilt)
      this.lastPushed = new Map(elements.map((e) => [e.id, e]))
      await saveDocument(rebuilt, safeThumb(rebuilt))
      this.applyingRemote = false
      setStatus('synced')
    } catch {
      this.applyingRemote = false
      setStatus('error')
    }
  }

  private async reconcileLibrary(): Promise<void> {
    const fb = await getFirebase()
    if (!fb || !this.uid) return
    const uid = this.uid
    setStatus('syncing')
    const remoteSnap = await getDocs(collection(fb.db, 'users', uid, 'documents'))
    const remote = new Map<string, RemoteMeta>(
      remoteSnap.docs.map((d) => [d.id, d.data() as RemoteMeta]),
    )
    const localMetas = await listDocuments()
    const localMap = new Map(localMetas.map((m) => [m.id, m]))

    // Upload local docs that are new or newer than their remote copy.
    for (const m of localMetas) {
      const r = remote.get(m.id)
      if (!r || m.updatedAt > (r.updatedAt ?? 0)) {
        const sketch = await loadLocalDoc(m.id)
        if (sketch) await this.uploadDoc(sketch)
      }
    }
    // Download remote docs that are new or newer than their local copy.
    for (const [id, r] of remote) {
      const l = localMap.get(id)
      if (!l || (r.updatedAt ?? 0) > l.updatedAt) {
        await this.downloadDoc(id, r)
      }
    }
    setStatus('synced')
  }

  private async uploadDoc(sketch: SketchDocument): Promise<void> {
    const fb = await getFirebase()
    if (!fb || !this.uid) return
    const p = this.paths(this.uid, sketch.id)
    for (let i = 0; i < sketch.elements.length; i += CHUNK) {
      const batch = writeBatch(fb.db)
      for (const el of sketch.elements.slice(i, i + CHUNK)) {
        batch.set(p.element(fb.db, el.id), el as unknown as Record<string, unknown>)
      }
      await batch.commit()
    }
    await setDoc(p.meta(fb.db), metaFrom(sketch, this.uid))
  }

  private async downloadDoc(docId: string, remote: RemoteMeta): Promise<void> {
    const fb = await getFirebase()
    if (!fb || !this.uid) return
    const snap = await getDocs(this.paths(this.uid, docId).elements(fb.db))
    const elements = snap.docs.map((d) => d.data() as Element)
    const rebuilt: SketchDocument = {
      id: docId,
      title: remote.title,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      background: remote.background,
      camera: remote.camera,
      layers: remote.layers,
      elements,
      version: remote.version,
      ownerId: this.uid,
    }
    await saveDocument(rebuilt, safeThumb(rebuilt))
  }
}

export const syncEngine = new SyncEngine()
