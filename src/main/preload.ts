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
  getAllReasons: () => ipcRenderer.invoke('get-all-reasons'),
  getExcludedReasons: () => ipcRenderer.invoke('get-excluded-reasons'),
  setExcludedReasons: (reasons: string[]) => ipcRenderer.invoke('set-excluded-reasons', reasons),
  onUpdateStatus: (callback: (status: { status: string; version?: string; percent?: number; message?: string }) => void) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data))
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getStudentNotifications: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-notifications', firstName, lastName),
  addNotification: (notification: { student_first_name: string; student_last_name: string; student_id?: string; notification_date: string; threshold_value: number; comment?: string }) =>
    ipcRenderer.invoke('add-notification', notification),
  deleteNotification: (id: number) => ipcRenderer.invoke('delete-notification', id),
})
