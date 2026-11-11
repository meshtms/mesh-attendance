// Browser implementation of window.electronAPI for the web build. It runs the
// same attendance database as the desktop app, in the page, and keeps it in
// this browser's IndexedDB. Nothing is sent to a server: the CSV is read
// locally and the database never leaves the machine.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import * as attendanceDb from '../shared/attendanceDb'

const IDB_NAME = 'casady-attendance'
const IDB_STORE = 'files'
const IDB_KEY = 'attendance.db'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<Uint8Array | null> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result as ArrayBuffer) : null)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Saves are queued so an older snapshot can never land after a newer one.
let saveChain: Promise<void> = Promise.resolve()
function queueSave(bytes: Uint8Array): void {
  saveChain = saveChain
    .then(() => idbPut(bytes))
    .catch((err) => console.error('Could not save attendance database', err))
}

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

  await attendanceDb.initDatabase({
    sql: () => initSqlJs({ locateFile: () => wasmUrl }),
    load: idbGet,
    save: queueSave,
  })

  const api: Window['electronAPI'] = {
    importCSV: async () => {
      const csv = await pickCsv()
      return csv === null ? null : attendanceDb.importCSV(csv)
    },
    refreshCSV: async () => {
      const csv = await pickCsv()
      if (csv === null) return null
      attendanceDb.clearAttendance()
      return attendanceDb.importCSV(csv)
    },
    clearAttendance: async () => attendanceDb.clearAttendance(),
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
