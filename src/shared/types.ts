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
      getStudentAbsences: () => Promise<StudentAbsence[]>
      getStudentCourseAbsences: (firstName: string, lastName: string) => Promise<StudentCourseAbsence[]>
      getStudentReasonAbsences: (firstName: string, lastName: string) => Promise<StudentReasonAbsence[]>
      getStudentRecords: (firstName: string, lastName: string) => Promise<AbsenceRecord[]>
      getStudentCourseRecords: (firstName: string, lastName: string, course: string) => Promise<AbsenceRecord[]>
      getStudentReasonRecords: (firstName: string, lastName: string, reason: string) => Promise<AbsenceRecord[]>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => void
      installUpdate: () => Promise<void>
      getVersion: () => Promise<string>
    }
  }
}

export interface UpdateStatus {
  status: 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
}
