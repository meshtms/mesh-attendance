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
      } catch (err) {
        // Electron wraps main-process errors as "Error invoking remote method
        // 'x': Error: <message>"; keep only the message.
        const message = (err instanceof Error ? err.message : String(err)).replace(
          /^Error invoking remote method '[^']+': (Error: )?/,
          '',
        )
        setSyncMessage(`${mode === 'refresh' ? 'Refresh' : 'Sync'} failed: ${message}`)
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
