import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/services/auth'
import { useSyncStatus } from '@/services/cloudStatus'
import { Panel } from './primitives'
import { CloudIcon, GoogleIcon } from './icons'

const STATUS_LABEL: Record<string, string> = {
  idle: 'Not synced',
  syncing: 'Syncing…',
  synced: 'All changes synced',
  error: 'Sync error',
}

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-white/30',
  syncing: 'bg-amber-400 animate-pulse',
  synced: 'bg-emerald-400',
  error: 'bg-red-400',
}

export function CloudMenu({ touch }: { touch: boolean }) {
  const user = useAuth((s) => s.user)
  const busy = useAuth((s) => s.busy)
  const signIn = useAuth((s) => s.signIn)
  const signOutUser = useAuth((s) => s.signOutUser)
  const status = useSyncStatus((s) => s.status)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const btn = touch ? 'h-12 w-12' : 'h-10 w-10'

  if (!user) {
    return (
      <button
        onClick={() => signIn()}
        disabled={busy}
        className="ml-1 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-white/90 disabled:opacity-50"
      >
        <GoogleIcon />
        <span className="hidden sm:inline">{busy ? 'Signing in…' : 'Sign in'}</span>
      </button>
    )
  }

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${btn} relative flex items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/20 hover:ring-white/40`}
        title={STATUS_LABEL[status]}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold text-white">{initial}</span>
        )}
        <span
          className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-black/40 ${STATUS_DOT[status]}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2">
          <Panel className="w-60 p-2">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold">{initial}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm text-white/90">
                  {user.displayName || 'Signed in'}
                </div>
                <div className="truncate text-xs text-white/40">{user.email}</div>
              </div>
            </div>

            <div className="my-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/60">
              <CloudIcon width={16} height={16} />
              {STATUS_LABEL[status]}
            </div>

            <button
              onClick={() => {
                setOpen(false)
                signOutUser()
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </Panel>
        </div>
      )}
    </div>
  )
}
