import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  importCSV: () => ipcRenderer.invoke('import-csv'),
  refreshCSV: () => ipcRenderer.invoke('refresh-csv'),
  clearAttendance: () => ipcRenderer.invoke('clear-attendance'),
  getStudentAbsences: () => ipcRenderer.invoke('get-student-absences'),
  getStudentCourseAbsences: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-course-absences', firstName, lastName),
  getStudentReasonAbsences: (firstName: string, lastName: string) =>
    ipcRenderer.invoke('get-student-reason-absences', firstName, lastName),
  getStudentRecords: (firstName: string, lastName: string, type?: string) =>
    ipcRenderer.invoke('get-student-records', firstName, lastName, type ?? 'ABSENCE'),
  getStudentCourseRecords: (firstName: string, lastName: string, course: string) =>
    ipcRenderer.invoke('get-student-course-records', firstName, lastName, course),
  getStudentReasonRecords: (firstName: string, lastName: string, reason: string) =>
    ipcRenderer.invoke('get-student-reason-records', firstName, lastName, reason),
  getCategoryTree: () => ipcRenderer.invoke('get-category-tree'),
  getExcludedReasons: () => ipcRenderer.invoke('get-excluded-reasons'),
  setExcludedReasons: (reasons: { attendance_category: string; reason: string }[]) =>
    ipcRenderer.invoke('set-excluded-reasons', reasons),
  setCategoryTypes: (types: { category: string; type: string }[]) =>
    ipcRenderer.invoke('set-category-types', types),
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
