import { create } from 'zustand'
import { getFirebase } from './firebase'

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface AuthState {
  user: AuthUser | null
  /** True once the initial auth state has resolved. */
  ready: boolean
  busy: boolean
  signIn: () => Promise<void>
  signOutUser: () => Promise<void>
  _set: (partial: Partial<AuthState>) => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  busy: false,

  signIn: async () => {
    const fb = await getFirebase()
    if (!fb) return
    set({ busy: true })
    try {
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import(
        'firebase/auth'
      )
      const provider = new GoogleAuthProvider()
      try {
        await signInWithPopup(fb.auth, provider)
      } catch {
        // Popups are often blocked on mobile; fall back to redirect.
        await signInWithRedirect(fb.auth, provider)
      }
    } finally {
      set({ busy: false })
    }
  },

  signOutUser: async () => {
    const fb = await getFirebase()
    if (!fb) return
    const { signOut } = await import('firebase/auth')
    await signOut(fb.auth)
  },

  _set: (partial) => set(partial),
}))

/** Begin observing auth state. Safe to call once at startup. */
export async function initAuth(): Promise<void> {
  const fb = await getFirebase()
  if (!fb) {
    useAuth.setState({ ready: true })
    return
  }
  const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')
  // Complete a redirect sign-in if we came back from one.
  getRedirectResult(fb.auth).catch(() => {})
  onAuthStateChanged(fb.auth, (u) => {
    useAuth.setState({
      ready: true,
      user: u
        ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL }
        : null,
    })
  })
}
