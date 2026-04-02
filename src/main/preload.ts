import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  importCSV: () => ipcRenderer.invoke('import-csv'),
  getStudentAbsences: () => ipcRenderer.invoke('get-student-absences'),
  getStudentCourseAbsences: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-course-absences', firstName, lastName),
  getStudentReasonAbsences: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-reason-absences', firstName, lastName),
  getStudentRecords: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-records', firstName, lastName),
  getStudentCourseRecords: (firstName: string, lastName: string, course: string) =>
    ipcRenderer.invoke('get-student-course-records', firstName, lastName, course),
  getStudentReasonRecords: (firstName: string, lastName: string, reason: string) =>
    ipcRenderer.invoke('get-student-reason-records', firstName, lastName, reason),
  onUpdateStatus: (callback: (status: { status: string; version?: string; percent?: number; message?: string }) => void) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data))
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
})
