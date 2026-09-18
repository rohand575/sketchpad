// Firebase integration is *scaffolded but inert* until you provide config via
// .env.local (see .env.example). When keys are absent the whole app runs
// fully local — no network, no errors, cloud UI stays hidden.
//
// v2 will lazy-import the Firebase SDK here and wire Google auth + Firestore
// document sync + Storage. Kept dependency-free for now so the local MVP has a
// zero-weight, zero-error cloud boundary.

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
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
  const configured = cfg.apiKey && cfg.projectId && cfg.appId
  return configured ? cfg : null
}

/** Whether cloud features (sign-in, sync) should be surfaced in the UI. */
export const isCloudEnabled = (): boolean => readFirebaseConfig() !== null
