import { useState, useEffect } from 'react'
import type { AbsenceRecord } from '../../shared/types'

export function useStudentRecords(firstName: string, lastName: string) {
  const [records, setRecords] = useState<AbsenceRecord[]>([])

  useEffect(() => {
    window.electronAPI.getStudentRecords(firstName, lastName).then(setRecords)
  }, [firstName, lastName])

  return { records }
}
