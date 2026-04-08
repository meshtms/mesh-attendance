import { useState, useCallback } from 'react'

export function useSync(onSynced: () => void) {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const run = useCallback(
    async (mode: 'sync' | 'refresh') => {
      setSyncing(true)
      setSyncMessage(null)
      try {
        const result =
          mode === 'refresh'
            ? await window.electronAPI.refreshCSV()
            : await window.electronAPI.importCSV()
        if (result) {
          setSyncMessage(
            mode === 'refresh'
              ? `Refreshed: ${result.inserted} loaded`
              : `${result.inserted} new, ${result.skipped} skipped`,
          )
          onSynced()
        }
      } catch {
        setSyncMessage(mode === 'refresh' ? 'Refresh failed' : 'Sync failed')
      } finally {
        setSyncing(false)
      }
    },
    [onSynced],
  )

  const sync = useCallback(() => run('sync'), [run])
  const refresh = useCallback(() => run('refresh'), [run])

  return { syncing, syncMessage, sync, refresh }
}
