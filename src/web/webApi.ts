// Browser implementation of window.electronAPI for the web build. It runs the
// same attendance database as the desktop app, in the page, and keeps it in
// this browser's IndexedDB. Nothing is sent to a server: the CSV is read
// locally and the database never leaves the machine.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import * as attendanceDb from '../shared/attendanceDb'
import * as datasets from '../shared/datasets'
import type { DatasetList } from '../shared/types'

// One object store holds the dataset registry and one entry per dataset.
// 'attendance.db' is the single database from before datasets existed; it is
// copied into the first dataset and left in place as a backup.
const IDB_NAME = 'casady-attendance'
const IDB_STORE = 'files'
const REGISTRY_KEY = 'registry'
const LEGACY_KEY = 'attendance.db'
const dbKey = (id: string) => `db:${id}`

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbWrite(key: string, value: unknown | undefined): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    if (value === undefined) store.delete(key)
    else store.put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Writes are queued, and reads wait for them, so an older snapshot can never
// land after a newer one and a dataset reopened right after a switch sees its
// latest save.
let writeChain: Promise<void> = Promise.resolve()
function queueWrite(key: string, value: unknown | undefined): Promise<void> {
  writeChain = writeChain
    .then(() => idbWrite(key, value))
    .catch((err) => console.error(`Could not save ${key}`, err))
  return writeChain
}
async function readBytes(key: string): Promise<Uint8Array | null> {
  await writeChain
  const value = await idbGet<ArrayBuffer>(key)
  return value ? new Uint8Array(value) : null
}
const toBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

/** Resolves with the chosen file's text, or null if the user cancels. */
function pickCsv(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,text/csv'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      resolve(file ? file.text() : null)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

export async function installWebApi(): Promise<void> {
  // Ask the browser not to evict our storage under disk pressure. Without this
  // the database is "best effort" and can be cleared silently.
  navigator.storage?.persist?.().catch(() => {})

  await datasets.initDatasets({
    sql: () => initSqlJs({ locateFile: () => wasmUrl }),
    loadRegistry: async () => {
      await writeChain
      return (await idbGet<DatasetList>(REGISTRY_KEY)) ?? null
    },
    saveRegistry: (list) => void queueWrite(REGISTRY_KEY, list),
    loadDb: (id) => readBytes(dbKey(id)),
    saveDb: (id, bytes) => void queueWrite(dbKey(id), toBuffer(bytes)),
    deleteDb: (id) => queueWrite(dbKey(id), undefined),
    loadLegacyDb: () => readBytes(LEGACY_KEY),
  })

  const api: Window['electronAPI'] = {
    importCSV: async () => {
      const csv = await pickCsv()
      return csv === null ? null : attendanceDb.importCSV(csv)
    },
    refreshCSV: async () => {
      const csv = await pickCsv()
      return csv === null ? null : attendanceDb.importCSV(csv, true)
    },
    listDatasets: async () => datasets.listDatasets(),
    switchDataset: (id) => datasets.switchDataset(id),
    createDataset: (name, copyFrom) => datasets.createDataset(name, copyFrom),
    renameDataset: async (id, name) => datasets.renameDataset(id, name),
    deleteDataset: (id) => datasets.deleteDataset(id),
    clearAttendance: async () => attendanceDb.clearAttendance(),
    resetSettings: async () => attendanceDb.resetSettings(),
    getStudentAbsences: async () => attendanceDb.getStudentAbsences(),
    getStudentCourseAbsences: async (f, l) => attendanceDb.getStudentCourseAbsences(f, l),
    getStudentReasonAbsences: async (f, l) => attendanceDb.getStudentReasonAbsences(f, l),
    getStudentRecords: async (f, l, type) => attendanceDb.getStudentRecords(f, l, type ?? 'ABSENCE'),
    getStudentCourseRecords: async (f, l, course) => attendanceDb.getStudentCourseRecords(f, l, course),
    getStudentReasonRecords: async (f, l, reason) => attendanceDb.getStudentReasonRecords(f, l, reason),
    getCategoryTree: async () => attendanceDb.getCategoryTree(),
    getExcludedReasons: async () => attendanceDb.getExcludedReasons(),
    setExcludedReasons: async (reasons) => attendanceDb.setExcludedReasons(reasons),
    setCategoryTypes: async (types) => attendanceDb.setCategoryTypes(types),
    // The web build updates by redeploying; there is nothing to install.
    onUpdateStatus: () => {},
    installUpdate: async () => {},
    getVersion: async () => __APP_VERSION__,
    getStudentNotifications: async (f, l) => attendanceDb.getStudentNotifications(f, l),
    addNotification: async (n) => attendanceDb.addNotification(n),
    deleteNotification: async (id) => attendanceDb.deleteNotification(id),
  }
  window.electronAPI = api
}
