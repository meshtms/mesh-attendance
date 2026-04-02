import { useState, useEffect } from 'react'
import type { AbsenceRecord } from '../../shared/types'

export function useStudentCourseRecords(firstName: string, lastName: string, course: string) {
  const [records, setRecords] = useState<AbsenceRecord[]>([])

  useEffect(() => {
    window.electronAPI.getStudentCourseRecords(firstName, lastName, course).then(setRecords)
  }, [firstName, lastName, course])

  return { records }
}
