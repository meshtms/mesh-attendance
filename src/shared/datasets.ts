// Datasets are independent silos (e.g. "Upper", "Middle"): each is its own
// database with its own attendance, category types, excluded reasons and
// notifications. Exactly one is open at a time; attendanceDb.ts always works
// on the open one. Shared by the desktop and web builds, which differ only in
// where the registry and each database are stored (DatasetHost).
import type { SqlJsStatic } from 'sql.js'
import { openDatabase, exportDatabase, copySettingsFrom } from './attendanceDb'
import type { DatasetList } from './types'

export interface DatasetHost {
  /** Loads sql.js (each build locates the .wasm differently). */
  sql: () => Promise<SqlJsStatic>
  loadRegistry: () => Promise<DatasetList | null>
  saveRegistry: (list: DatasetList) => void
  /** A dataset's saved database, or null if it has none yet. */
  loadDb: (id: string) => Promise<Uint8Array | null>
  saveDb: (id: string, bytes: Uint8Array) => void
  deleteDb: (id: string) => Promise<void>
  /** The single database from before datasets existed, if any. */
  loadLegacyDb: () => Promise<Uint8Array | null>
}

const FIRST_DATASET_NAME = 'Default'

let host: DatasetHost | null = null
let SQL: SqlJsStatic | null = null
let registry: DatasetList = { datasets: [], currentId: '' }

function requireHost(): DatasetHost {
  if (!host) throw new Error('Datasets not initialized')
  return host
}

const snapshot = (): DatasetList => ({
  datasets: registry.datasets.map((d) => ({ ...d })),
  currentId: registry.currentId,
})

function saveRegistry(): void {
  requireHost().saveRegistry(snapshot())
}

/** Opens a dataset. Pass `bytes` to use them instead of what is stored. */
async function open(id: string, bytes?: Uint8Array | null): Promise<void> {
  const h = requireHost()
  const data = bytes !== undefined ? bytes : await h.loadDb(id)
  // Bind the id now: a save must never land in whichever dataset is open later.
  await openDatabase(SQL!, data, (b) => h.saveDb(id, b))
}

function cleanName(name: string, exceptId?: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a name.')
  const taken = registry.datasets.some(
    (d) => d.id !== exceptId && d.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) throw new Error(`There is already a dataset named "${trimmed}".`)
  return trimmed
}

export async function initDatasets(datasetHost: DatasetHost): Promise<void> {
  host = datasetHost
  SQL = await host.sql()

  const saved = await host.loadRegistry()
  if (saved && saved.datasets.length > 0) {
    registry = saved
    if (!registry.datasets.some((d) => d.id === registry.currentId)) {
      registry.currentId = registry.datasets[0].id
      saveRegistry()
    }
    await open(registry.currentId)
    return
  }

  // First run with datasets: whatever was there before becomes the first one.
  // The old database is copied, not moved, so it stays as a backup.
  const id = globalThis.crypto.randomUUID()
  const legacy = await host.loadLegacyDb()
  await open(id, legacy) // opening saves it under the new id
  registry = { datasets: [{ id, name: FIRST_DATASET_NAME }], currentId: id }
  saveRegistry()
}

export function listDatasets(): DatasetList {
  return snapshot()
}

export async function switchDataset(id: string): Promise<DatasetList> {
  if (!registry.datasets.some((d) => d.id === id)) throw new Error('That dataset no longer exists.')
  if (id !== registry.currentId) {
    await open(id)
    registry.currentId = id
    saveRegistry()
  }
  return snapshot()
}

/** Creates a dataset and switches to it, optionally copying another's settings. */
export async function createDataset(name: string, copySettingsFromId?: string): Promise<DatasetList> {
  const h = requireHost()
  const clean = cleanName(name)
  let source: Uint8Array | null = null
  if (copySettingsFromId) {
    source =
      copySettingsFromId === registry.currentId ? exportDatabase() : await h.loadDb(copySettingsFromId)
  }

  const id = globalThis.crypto.randomUUID()
  await open(id, null)
  try {
    if (source) copySettingsFrom(source)
  } catch (err) {
    // Back to where we were, without leaving an orphaned database behind.
    await open(registry.currentId)
    await h.deleteDb(id)
    throw err
  }
  registry.datasets.push({ id, name: clean })
  registry.currentId = id
  saveRegistry()
  return snapshot()
}

export function renameDataset(id: string, name: string): DatasetList {
  const dataset = registry.datasets.find((d) => d.id === id)
  if (!dataset) throw new Error('That dataset no longer exists.')
  dataset.name = cleanName(name, id)
  saveRegistry()
  return snapshot()
}

/** Permanently deletes a dataset. The last one cannot be deleted. */
export async function deleteDataset(id: string): Promise<DatasetList> {
  const h = requireHost()
  if (!registry.datasets.some((d) => d.id === id)) throw new Error('That dataset no longer exists.')
  if (registry.datasets.length === 1) throw new Error('The last dataset cannot be deleted.')

  registry.datasets = registry.datasets.filter((d) => d.id !== id)
  if (registry.currentId === id) {
    registry.currentId = registry.datasets[0].id
    await open(registry.currentId)
  }
  saveRegistry()
  await h.deleteDb(id)
  return snapshot()
}
