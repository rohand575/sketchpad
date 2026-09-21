// Firebase integration. The SDK is *lazy-loaded* — nothing is imported unless
// valid config exists in .env.local (see .env.example). With no config the app
// runs fully local: no network, no bundle weight, no errors.

import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export interface FirebaseServices {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

export function readFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env
  const cfg: FirebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  }
  return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null
}

/** Whether cloud features (sign-in, sync) should be surfaced in the UI. */
export const isCloudEnabled = (): boolean => readFirebaseConfig() !== null

let cached: Promise<FirebaseServices | null> | null = null

/** Initialize Firebase once (or return null if not configured). */
export function getFirebase(): Promise<FirebaseServices | null> {
  if (cached) return cached
  const cfg = readFirebaseConfig()
  if (!cfg) {
    cached = Promise.resolve(null)
    return cached
  }
  cached = (async () => {
    const { initializeApp } = await import('firebase/app')
    const { getAuth } = await import('firebase/auth')
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
      await import('firebase/firestore')
    const app = initializeApp(cfg)
    const auth = getAuth(app)
    // Offline persistence: Firestore caches to IndexedDB and syncs on reconnect.
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    return { app, auth, db }
  })()
  return cached
}
