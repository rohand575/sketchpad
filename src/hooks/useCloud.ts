import { useEffect } from 'react'
import { isCloudEnabled } from '@/services/firebase'
import { initAuth, useAuth } from '@/services/auth'

/**
 * Boots auth observation and drives the sync engine on sign-in/out.
 * No-op (and loads no firebase code) when cloud isn't configured.
 */
export function useCloud(): void {
  useEffect(() => {
    if (isCloudEnabled()) void initAuth()
  }, [])

  const uid = useAuth((s) => s.user?.uid ?? null)

  useEffect(() => {
    if (!isCloudEnabled()) return
    let disposed = false
    ;(async () => {
      const { syncEngine } = await import('@/services/sync')
      if (disposed) return
      if (uid) void syncEngine.start(uid)
      else syncEngine.stop()
    })()
    return () => {
      disposed = true
    }
  }, [uid])
}
