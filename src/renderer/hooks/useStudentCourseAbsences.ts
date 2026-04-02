import { useState, useEffect } from 'react'
import type { StudentCourseAbsence } from '../../shared/types'

export function useStudentCourseAbsences(firstName: string, lastName: string) {
  const [courses, setCourses] = useState<StudentCourseAbsence[]>([])

  useEffect(() => {
    window.electronAPI.getStudentCourseAbsences(firstName, lastName).then(setCourses)
  }, [firstName, lastName])

  return { courses }
}
