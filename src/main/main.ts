import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import initSqlJs from 'sql.js'
import { autoUpdater } from 'electron-updater'
import { initDatasets, listDatasets, switchDataset, createDataset, renameDataset, deleteDataset } from '../shared/datasets'
import { importCSV, clearAttendance, resetSettings, getStudentAbsences, getStudentCourseAbsences, getStudentReasonAbsences, getStudentRecords, getStudentCourseRecords, getStudentReasonRecords, getCategoryTree, getExcludedReasons, setExcludedReasons, setCategoryTypes, getStudentNotifications, addNotification, deleteNotification } from '../shared/attendanceDb'
import type { CategoryType, CategoryTypeAssignment, ExcludedReason, NewNotification } from '../shared/types'

let mainWindow: BrowserWindow | null = null

// Demo/preview builds ship under their own product name and app id so they can
// sit alongside a real install. They must never talk to the release feed.
const IS_PREVIEW = app.getName().toLowerCase().includes('preview')

// One running copy per install. Each copy holds the whole database in memory
// and writes all of it on every save, so a second copy would silently
// overwrite the first one's changes. Launching again just brings the existing
// window forward. (The lock is per app, so the preview and the real app can
// still run side by side.)
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    title: `${app.getName()} v${app.getVersion()}`,
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // Preview builds are handed to other people on machines we cannot inspect,
  // so leave a way to read an error: F12 opens DevTools, and renderer console
  // messages are mirrored to the terminal/log.
  if (IS_PREVIEW) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools()
      }
    })
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
    })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.setTitle(`${app.getName()} v${app.getVersion()}`)
  })
}

// The desktop build keeps each dataset as userData/datasets/<id>.db, listed in
// userData/datasets/registry.json. userData/attendance.db is the database from
// before datasets; it is copied into the first dataset and left as a backup.
const userData = (...parts: string[]) => join(app.getPath('userData'), ...parts)
const datasetDir = () => userData('datasets')
const datasetPath = (id: string) => join(datasetDir(), `${id}.db`)
const registryPath = () => join(datasetDir(), 'registry.json')
const readIfExists = (path: string) => (existsSync(path) ? new Uint8Array(readFileSync(path)) : null)

app.whenReady().then(async () => {
  if (!isPrimaryInstance) return
  mkdirSync(datasetDir(), { recursive: true })
  await initDatasets({
    sql: () => initSqlJs(),
    loadRegistry: async () =>
      existsSync(registryPath()) ? JSON.parse(readFileSync(registryPath(), 'utf-8')) : null,
    saveRegistry: (list) => writeFileSync(registryPath(), JSON.stringify(list, null, 2)),
    loadDb: async (id) => readIfExists(datasetPath(id)),
    saveDb: (id, bytes) => writeFileSync(datasetPath(id), Buffer.from(bytes)),
    deleteDb: async (id) => rmSync(datasetPath(id), { force: true }),
    loadLegacyDb: async () => readIfExists(userData('attendance.db')),
  })

  ipcMain.handle('list-datasets', () => listDatasets())
  ipcMain.handle('switch-dataset', (_event, id: string) => switchDataset(id))
  ipcMain.handle('create-dataset', (_event, name: string, copySettingsFromId?: string) =>
    createDataset(name, copySettingsFromId),
  )
  ipcMain.handle('rename-dataset', (_event, id: string, name: string) => renameDataset(id, name))
  ipcMain.handle('delete-dataset', (_event, id: string) => deleteDataset(id))

  ipcMain.handle('import-csv', async () => {
    if (!mainWindow) return

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Attendance CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return importCSV(readFileSync(result.filePaths[0], 'utf-8'))
  })

  ipcMain.handle('clear-attendance', () => {
    clearAttendance()
  })

  ipcMain.handle('reset-settings', () => {
    resetSettings()
  })

  ipcMain.handle('refresh-csv', async () => {
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Attendance CSV (Refresh)',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    // Replaces the data only once the file has imported cleanly.
    return importCSV(readFileSync(result.filePaths[0], 'utf-8'), true)
  })

  ipcMain.handle('get-student-absences', () => {
    return getStudentAbsences()
  })

  ipcMain.handle('get-student-course-absences', (_event, firstName: string, lastName: string) => {
    return getStudentCourseAbsences(firstName, lastName)
  })

  ipcMain.handle('get-student-reason-absences', (_event, firstName: string, lastName: string) => {
    return getStudentReasonAbsences(firstName, lastName)
  })

  ipcMain.handle('get-student-records', (_event, firstName: string, lastName: string, type: CategoryType) => {
    return getStudentRecords(firstName, lastName, type)
  })

  ipcMain.handle('get-student-course-records', (_event, firstName: string, lastName: string, course: string) => {
    return getStudentCourseRecords(firstName, lastName, course)
  })

  ipcMain.handle('get-student-reason-records', (_event, firstName: string, lastName: string, reason: string) => {
    return getStudentReasonRecords(firstName, lastName, reason)
  })

  ipcMain.handle('get-category-tree', () => {
    return getCategoryTree()
  })

  ipcMain.handle('get-excluded-reasons', () => {
    return getExcludedReasons()
  })

  ipcMain.handle('set-excluded-reasons', (_event, reasons: ExcludedReason[]) => {
    setExcludedReasons(reasons)
  })

  ipcMain.handle('set-category-types', (_event, types: CategoryTypeAssignment[]) => {
    setCategoryTypes(types)
  })

  ipcMain.handle('get-student-notifications', (_event, firstName: string, lastName: string) => {
    return getStudentNotifications(firstName, lastName)
  })

  ipcMain.handle('add-notification', (_event, notification: NewNotification) => {
    return addNotification(notification)
  })

  ipcMain.handle('delete-notification', (_event, id: number) => {
    deleteNotification(id)
  })

  createWindow()

  // Auto-update (production builds only, never preview builds)
  if (!process.env.VITE_DEV_SERVER_URL && !IS_PREVIEW) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-status', { status: 'available', version: info.version })
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-status', { status: 'downloading', percent: Math.round(progress.percent) })
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update-status', { status: 'ready' })
    })

    autoUpdater.on('error', (err) => {
      mainWindow?.webContents.send('update-status', { status: 'error', message: err.message })
    })

    autoUpdater.checkForUpdates()
  }

  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
