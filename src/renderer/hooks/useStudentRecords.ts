import { useState, useEffect } from 'react'
import type { AbsenceRecord, CategoryType } from '../../shared/types'

export function useStudentRecords(
  firstName: string,
  lastName: string,
  type: CategoryType = 'ABSENCE',
) {
  const [records, setRecords] = useState<AbsenceRecord[]>([])

  useEffect(() => {
    window.electronAPI.getStudentRecords(firstName, lastName, type).then(setRecords)
  }, [firstName, lastName, type])

  return { records }
}
