import { useState, useCallback } from 'react'

export function useSync(onSynced: () => void) {
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const sync = useCallback(async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const result = await window.electronAPI.importCSV()
      if (result) {
        setSyncMessage(`${result.inserted} new, ${result.skipped} skipped`)
        onSynced()
      }
    } catch {
      setSyncMessage('Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [onSynced])

  return { syncing, syncMessage, sync }
}
