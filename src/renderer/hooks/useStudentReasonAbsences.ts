import { useState, useEffect } from 'react'
import type { StudentReasonAbsence } from '../../shared/types'

export function useStudentReasonAbsences(firstName: string, lastName: string) {
  const [reasons, setReasons] = useState<StudentReasonAbsence[]>([])

  useEffect(() => {
    window.electronAPI.getStudentReasonAbsences(firstName, lastName).then(setReasons)
  }, [firstName, lastName])

  return { reasons }
}
