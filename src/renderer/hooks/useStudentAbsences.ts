import { useState, useEffect, useCallback } from 'react'
import type { StudentAbsence } from '../../shared/types'

export function useStudentAbsences() {
  const [students, setStudents] = useState<StudentAbsence[]>([])

  const load = useCallback(async () => {
    const data = await window.electronAPI.getStudentAbsences()
    setStudents(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { students, reload: load }
}
