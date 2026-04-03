import { useState } from 'react'
import { Box, Button, IconButton, Typography } from '@mui/material'
import { useStudentCourseAbsences } from '../hooks/useStudentCourseAbsences'
import { useStudentReasonAbsences } from '../hooks/useStudentReasonAbsences'
import AbsenceDonutChart from './AbsenceDonutChart'
import AbsenceBarChart from './AbsenceBarChart'
import DrillDetail from './DrillDetail'
import type { StudentAbsence } from '../../shared/types'

interface Props {
  student: StudentAbsence
  onBack: () => void
}

interface Drill {
  type: 'course' | 'reason'
  value: string
}

const VIEWS = ['Total', 'Fall', 'Spring'] as const

function StudentDetail({ student, onBack }: Props) {
  const [viewIndex, setViewIndex] = useState(0)
  const [drill, setDrill] = useState<Drill | null>(null)

  const { courses } = useStudentCourseAbsences(
    student.student_first_name,
    student.student_last_name,
  )
  const { reasons } = useStudentReasonAbsences(
    student.student_first_name,
    student.student_last_name,
  )

  if (drill) {
    return (
      <DrillDetail
        student={student}
      />
    )
  }

  const courseData = {
    Total: courses.map((c) => ({ name: c.course, value: c.total_absences })),
    Fall: courses.map((c) => ({ name: c.course, value: c.fall_absences })),
    Spring: courses.map((c) => ({ name: c.course, value: c.spring_absences })),
  }
  const reasonData = {
    Total: reasons.map((r) => ({ name: r.reason, value: r.total_absences })),
    Fall: reasons.map((r) => ({ name: r.reason, value: r.fall_absences })),
    Spring: reasons.map((r) => ({ name: r.reason, value: r.spring_absences })),
  }

  const currentView = VIEWS[viewIndex]
  const canPrev = viewIndex > 0
  const canNext = viewIndex < VIEWS.length - 1

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, pt: 2, pb: 1 }}>
        <Button variant="outlined" onClick={onBack} size="small">
          Return to Grid
        </Button>
        <Typography variant="h6">
          {student.student_first_name} {student.student_last_name}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
        {VIEWS.map((view, i) => (
          <Box
            key={view}
            onClick={() => setViewIndex(i)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              cursor: 'pointer',
              backgroundColor: i === viewIndex ? 'primary.main' : 'transparent',
              color: i === viewIndex ? 'primary.contrastText' : 'text.secondary',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: i === viewIndex ? 'primary.main' : 'action.hover',
              },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: i === viewIndex ? 600 : 400 }}>
              {view}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', px: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <IconButton
            onClick={() => setViewIndex((i) => i - 1)}
            disabled={!canPrev}
            size="large"
            sx={{ opacity: canPrev ? 1 : 0.3 }}
          >
            <Typography variant="h5" sx={{ lineHeight: 1 }}>&#8249;</Typography>
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" sx={{ px: 1, pb: 0.5 }}>
              Absences by Course
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <AbsenceDonutChart
                title={currentView}
                data={courseData[currentView]}
                onItemClick={(name) => setDrill({ type: 'course', value: name })}
              />
            </Box>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" sx={{ px: 1, pb: 0.5 }}>
              Absences by Reason
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <AbsenceBarChart
                title={currentView}
                data={reasonData[currentView]}
                colorMode="excused"
                onItemClick={(name) => setDrill({ type: 'reason', value: name })}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <IconButton
            onClick={() => setViewIndex((i) => i + 1)}
            disabled={!canNext}
            size="large"
            sx={{ opacity: canNext ? 1 : 0.3 }}
          >
            <Typography variant="h5" sx={{ lineHeight: 1 }}>&#8250;</Typography>
          </IconButton>
        </Box>
      </Box>
    </Box>
  )
}

export default StudentDetail
