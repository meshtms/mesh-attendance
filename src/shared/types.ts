export interface ImportResult {
  total: number
  inserted: number
  skipped: number
}

export interface StudentAbsence {
  student_first_name: string
  student_last_name: string
  total_absences: number
  fall_absences: number
  spring_absences: number
  student_id: string
  max_class_absences: number
  max_class_fall: number
  max_class_spring: number
}

export interface StudentCourseAbsence {
  course: string
  total_absences: number
  fall_absences: number
  spring_absences: number
}

export interface StudentReasonAbsence {
  reason: string
  total_absences: number
  fall_absences: number
  spring_absences: number
}

export interface AbsenceRecord {
  attendance_date: string
  reason: string
  course: string
  excused_unexcused: string
  absence_value: number
}

declare global {
  interface Window {
    electronAPI: {
      importCSV: () => Promise<ImportResult | null>
      refreshCSV: () => Promise<ImportResult | null>
      clearAttendance: () => Promise<void>
      getStudentAbsences: () => Promise<StudentAbsence[]>
      getStudentCourseAbsences: (firstName: string, lastName: string) => Promise<StudentCourseAbsence[]>
      getStudentReasonAbsences: (firstName: string, lastName: string) => Promise<StudentReasonAbsence[]>
      getStudentRecords: (firstName: string, lastName: string) => Promise<AbsenceRecord[]>
      getStudentCourseRecords: (firstName: string, lastName: string, course: string) => Promise<AbsenceRecord[]>
      getStudentReasonRecords: (firstName: string, lastName: string, reason: string) => Promise<AbsenceRecord[]>
      getAllReasons: () => Promise<string[]>
      getExcludedReasons: () => Promise<string[]>
      setExcludedReasons: (reasons: string[]) => Promise<void>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void
      installUpdate: () => Promise<void>
      getVersion: () => Promise<string>
      getStudentNotifications: (firstName: string, lastName: string) => Promise<Notification[]>
      addNotification: (notification: NewNotification) => Promise<number>
      deleteNotification: (id: number) => Promise<void>
    }
  }
}

export interface UpdateStatus {
  status: 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface Notification {
  id: number
  student_first_name: string
  student_last_name: string
  student_id: string
  notification_date: string
  threshold_value: number
  comment: string
  created_at: string
}

export interface NewNotification {
  student_first_name: string
  student_last_name: string
  student_id?: string
  notification_date: string
  threshold_value: number
  comment?: string
}
