import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { initDatabase, importCSV, getStudentAbsences, getStudentCourseAbsences, getStudentReasonAbsences, getStudentRecords, getStudentCourseRecords, getStudentReasonRecords, getAllReasons, getExcludedReasons, setExcludedReasons, getStudentNotifications, addNotification, deleteNotification } from './database'
import type { NewNotification } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    title: `Casady Attendance v${app.getVersion()}`,
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

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.setTitle(`Casady Attendance v${app.getVersion()}`)
  })
}

app.whenReady().then(async () => {
  await initDatabase()

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

    return importCSV(result.filePaths[0])
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

  ipcMain.handle('get-student-records', (_event, firstName: string, lastName: string) => {
    return getStudentRecords(firstName, lastName)
  })

  ipcMain.handle('get-student-course-records', (_event, firstName: string, lastName: string, course: string) => {
    return getStudentCourseRecords(firstName, lastName, course)
  })

  ipcMain.handle('get-student-reason-records', (_event, firstName: string, lastName: string, reason: string) => {
    return getStudentReasonRecords(firstName, lastName, reason)
  })

  ipcMain.handle('get-all-reasons', () => {
    return getAllReasons()
  })

  ipcMain.handle('get-excluded-reasons', () => {
    return getExcludedReasons()
  })

  ipcMain.handle('set-excluded-reasons', (_event, reasons: string[]) => {
    setExcludedReasons(reasons)
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

  // Auto-update (only in production builds)
  if (!process.env.VITE_DEV_SERVER_URL) {
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
