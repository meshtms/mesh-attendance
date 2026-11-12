export interface ImportResult {
  total: number
  inserted: number
  skipped: number
}

// How a CSV "Attendance category" is bucketed. Categories are typed rather than
// individually excluded so upstream renames (the school added "Tardy" mid-2026)
// only require re-typing the category, not rewriting the reason exclusions.
// Add new buckets here; the DB stores the type as free text.
export const CATEGORY_TYPES = ['ABSENCE', 'TARDY'] as const
export type CategoryType = (typeof CATEGORY_TYPES)[number]

export interface CategoryInfo {
  category: string
  type: CategoryType
  reasons: string[]
}

// Reasons repeat across categories (e.g. "Illness" is both an excused absence
// and a tardy), so an exclusion is only meaningful scoped to its category.
export interface ExcludedReason {
  attendance_category: string
  reason: string
}

export interface CategoryTypeAssignment {
  category: string
  type: CategoryType
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
  total_tardies: number
  fall_tardies: number
  spring_tardies: number
  max_class_tardies: number
  max_class_tardies_fall: number
  max_class_tardies_spring: number
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
      listDatasets: () => Promise<DatasetList>
      switchDataset: (id: string) => Promise<DatasetList>
      createDataset: (name: string, copySettingsFromId?: string) => Promise<DatasetList>
      renameDataset: (id: string, name: string) => Promise<DatasetList>
      deleteDataset: (id: string) => Promise<DatasetList>
      clearAttendance: () => Promise<void>
      resetSettings: () => Promise<void>
      getStudentAbsences: () => Promise<StudentAbsence[]>
      getStudentCourseAbsences: (firstName: string, lastName: string) => Promise<StudentCourseAbsence[]>
      getStudentReasonAbsences: (firstName: string, lastName: string) => Promise<StudentReasonAbsence[]>
      getStudentRecords: (firstName: string, lastName: string, type?: CategoryType) => Promise<AbsenceRecord[]>
      getStudentCourseRecords: (firstName: string, lastName: string, course: string) => Promise<AbsenceRecord[]>
      getStudentReasonRecords: (firstName: string, lastName: string, reason: string) => Promise<AbsenceRecord[]>
      getCategoryTree: () => Promise<CategoryInfo[]>
      getExcludedReasons: () => Promise<ExcludedReason[]>
      setExcludedReasons: (reasons: ExcludedReason[]) => Promise<void>
      setCategoryTypes: (types: CategoryTypeAssignment[]) => Promise<void>
      /** Subscribes to update state changes; returns an unsubscribe function. */
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
      getUpdateStatus: () => Promise<UpdateStatus>
      checkForUpdates: () => Promise<void>
      installUpdate: () => Promise<void>
      getVersion: () => Promise<string>
      getStudentNotifications: (firstName: string, lastName: string) => Promise<Notification[]>
      addNotification: (notification: NewNotification) => Promise<number>
      deleteNotification: (id: number) => Promise<void>
    }
  }
}

/** One independent silo of attendance data and its settings. */
export interface DatasetInfo {
  id: string
  name: string
}

export interface DatasetList {
  datasets: DatasetInfo[]
  currentId: string
}

export interface UpdateStatus {
  /**
   * disabled: this build can't self-update (dev, preview, web).
   * idle: nothing pending. checking: a check someone asked for is running.
   * up-to-date: that check found nothing (shown briefly, then idle).
   */
  status: 'disabled' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'ready' | 'error'
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
