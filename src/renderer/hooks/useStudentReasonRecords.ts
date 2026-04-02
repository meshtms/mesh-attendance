import { useState, useEffect } from 'react'
import type { AbsenceRecord } from '../../shared/types'

export function useStudentReasonRecords(firstName: string, lastName: string, reason: string) {
  const [records, setRecords] = useState<AbsenceRecord[]>([])

  useEffect(() => {
    window.electronAPI.getStudentReasonRecords(firstName, lastName, reason).then(setRecords)
  }, [firstName, lastName, reason])

  return { records }
}
