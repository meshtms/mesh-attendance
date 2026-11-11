import { useEffect, useState } from 'react'
import type { DatasetList } from '../shared/types'
import App from './App'

/**
 * Owns which dataset is open. App is keyed by the dataset id, so switching
 * remounts it: filters, the selected student and the Settings page all start
 * fresh and nothing from the previous dataset can linger on screen.
 */
function Root() {
  const [datasets, setDatasets] = useState<DatasetList | null>(null)

  useEffect(() => {
    window.electronAPI.listDatasets().then(setDatasets)
  }, [])

  if (!datasets) return null
  return <App key={datasets.currentId} datasets={datasets} onDatasetsChange={setDatasets} />
}

export default Root
