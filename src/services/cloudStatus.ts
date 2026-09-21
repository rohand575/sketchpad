import { create } from 'zustand'

// Kept in its own module (no firebase imports) so the UI can read sync status
// without pulling the firestore SDK into the local-only bundle.

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface SyncStatusState {
  status: SyncStatus
  lastSyncedAt: number | null
}

export const useSyncStatus = create<SyncStatusState>(() => ({
  status: 'idle',
  lastSyncedAt: null,
}))

export function setSyncStatus(status: SyncStatus): void {
  useSyncStatus.setState((s) => ({
    status,
    lastSyncedAt: status === 'synced' ? Date.now() : s.lastSyncedAt,
  }))
}
