import { useState, useMemo, useCallback, useEffect } from 'react'
import { Box, Button, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { useStudentRecords } from '../hooks/useStudentRecords'
import { getColor, COLOR_EXCUSED, COLOR_UNEXCUSED, type ChartEntry } from './chartColors'
import NotificationHistory from './NotificationHistory'
import type { StudentAbsence, AbsenceRecord } from '../../shared/types'

interface Props {
  student: StudentAbsence
}

function renderStatus(params: GridRenderCellParams) {
  const value = params.value as string
  const color = value?.toLowerCase() === 'unexcused' ? COLOR_UNEXCUSED : COLOR_EXCUSED
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%' }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: color, flexShrink: 0 }} />
      {value}
    </Box>
  )
}

const columns: GridColDef[] = [
  { field: 'attendance_date', headerName: 'Date', width: 120 },
  { field: 'course', headerName: 'Course', width: 180 },
  { field: 'reason', headerName: 'Reason', flex: 1, minWidth: 160 },
  { field: 'excused_unexcused', headerName: 'Status', width: 140, renderCell: renderStatus },
  {
    field: 'absence_value',
    headerName: 'Value',
    width: 80,
    type: 'number',
    valueFormatter: (value: number | null) => value != null ? value.toFixed(1) : '',
  },
]

function buildGroupData(records: AbsenceRecord[], groupBy: 'course' | 'reason' | 'excused_unexcused') {
  return Object.values(
    records.reduce<Record<string, { name: string; value: number }>>((acc, r) => {
      const key = r[groupBy]
      if (!acc[key]) acc[key] = { name: key, value: 0 }
      acc[key].value += r.absence_value
      return acc
    }, {}),
  )
}

function formatNum(value: number): string {
  return value % 1 === 0.5 ? value.toFixed(1) : Math.round(value).toString()
}

const toggleBtnSx = (active: boolean) => ({
  px: 1.25,
  py: 0.25,
  borderRadius: '4px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'primary.main' : 'text.secondary',
  backgroundColor: active ? 'primary.50' : 'grey.100',
  border: '1px solid',
  borderColor: active ? 'primary.200' : 'grey.300',
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: active ? 'primary.50' : 'grey.200',
  },
})

function useToggleSet(initial: Set<string>) {
  const [selected, setSelected] = useState<Set<string>>(initial)

  const toggle = useCallback((value: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }, [])

  return { selected, toggle }
}

function DrillDetail({ student }: Props) {
  const { records: allRecords } = useStudentRecords(
    student.student_first_name,
    student.student_last_name,
  )

  const allCourses = useMemo(
    () => [...new Set(allRecords.map((r) => r.course))].sort(),
    [allRecords],
  )

  const fallCutoff = useMemo(() => {
    if (allRecords.length === 0) return ''
    const dates = allRecords.map((r) => r.attendance_date).sort()
    const minDate = dates[0]
    const minYear = parseInt(minDate.substring(0, 4))
    const minMonth = parseInt(minDate.substring(5, 7))
    const fallYear = minMonth <= 7 ? minYear - 1 : minYear
    return `${fallYear}-12-31`
  }, [allRecords])

  // Determine current semester based on today's date (Aug-Dec = Fall, Jan-Jul = Spring)
  const currentSemester = useMemo(() => {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    return month >= 8 ? 'Fall' : 'Spring'
  }, [])

  const [semesterFilter, setSemesterFilter] = useState<'Full Year' | 'Fall' | 'Spring'>(currentSemester)
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'single' | 'multi'>('single')
  const [pendingCourses, setPendingCourses] = useState<string[]>([])
  const [showHeadings, setShowHeadings] = useState(true)

  const getCoursesForTerm = useCallback((term: 'Full Year' | 'Fall' | 'Spring') => {
    let records = allRecords
    if (term === 'Fall') {
      records = records.filter((r) => r.attendance_date <= fallCutoff)
    } else if (term === 'Spring') {
      records = records.filter((r) => r.attendance_date > fallCutoff)
    }
    return [...new Set(records.map((r) => r.course))].sort()
  }, [allRecords, fallCutoff])

  const semesterCourses = useMemo(() => {
    return getCoursesForTerm(semesterFilter)
  }, [getCoursesForTerm, semesterFilter])

  const changeTerm = useCallback((term: 'Full Year' | 'Fall' | 'Spring') => {
    setSemesterFilter(term)
    setSelectedCourses(getCoursesForTerm(term))
  }, [getCoursesForTerm])

  // Initialize selectedCourses with all courses when they load
  useEffect(() => {
    if (allCourses.length > 0 && selectedCourses.length === 0) {
      setSelectedCourses(allCourses)
    }
  }, [allCourses])

  const openSingleSelect = () => {
    setDialogMode('single')
    setDialogOpen(true)
  }

  const openMultiSelect = () => {
    setDialogMode('multi')
    setPendingCourses(selectedCourses)
    setDialogOpen(true)
  }

  const handleClassClick = (course: string) => {
    if (dialogMode === 'single') {
      setSelectedCourses([course])
      setDialogOpen(false)
    } else {
      setPendingCourses((prev) =>
        prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course]
      )
    }
  }

  const applyMultiSelect = () => {
    if (pendingCourses.length > 0) {
      setSelectedCourses(pendingCourses)
    }
    setDialogOpen(false)
  }

  const selectAllClasses = () => {
    setSelectedCourses(semesterCourses)
  }

  // Check if all semester courses are selected
  const isAllSelected = semesterCourses.length > 0 && semesterCourses.every((c) => selectedCourses.includes(c))
  const isOneSelected = selectedCourses.length === 1

  const filteredRecords = useMemo(() => {
    let result = allRecords
    if (semesterFilter === 'Fall')
      result = result.filter((r) => r.attendance_date <= fallCutoff)
    else if (semesterFilter === 'Spring')
      result = result.filter((r) => r.attendance_date > fallCutoff)
    // Filter by selected courses (if not all selected)
    if (selectedCourses.length > 0 && selectedCourses.length < allCourses.length)
      result = result.filter((r) => selectedCourses.includes(r.course))
    return result
  }, [allRecords, fallCutoff, semesterFilter, selectedCourses, allCourses.length])

  const courseData = useMemo(
    () => buildGroupData(filteredRecords, 'course').sort((a, b) => b.value - a.value),
    [filteredRecords],
  )
  const courseTotal = courseData.reduce((s, d) => s + d.value, 0)

  const reasonData = buildGroupData(filteredRecords, 'reason')
  const reasonColorMode = 'excused' as const
  const statusData = buildGroupData(filteredRecords, 'excused_unexcused')

  const termTotals = useMemo(() => {
    const fallTotal = allRecords
      .filter((r) => r.attendance_date <= fallCutoff)
      .reduce((s, r) => s + r.absence_value, 0)
    const springTotal = allRecords
      .filter((r) => r.attendance_date > fallCutoff)
      .reduce((s, r) => s + r.absence_value, 0)
    const yearTotal = allRecords.reduce((s, r) => s + r.absence_value, 0)
    return { fall: fallTotal, spring: springTotal, year: yearTotal }
  }, [allRecords, fallCutoff])

  const dayOfWeekData = useMemo(() => {
    const days = [
      { label: 'M', full: 'Monday' },
      { label: 'T', full: 'Tuesday' },
      { label: 'W', full: 'Wednesday' },
      { label: 'T', full: 'Thursday' },
      { label: 'F', full: 'Friday' },
    ]
    const counts = [0, 0, 0, 0, 0]
    for (const r of filteredRecords) {
      const date = new Date(r.attendance_date)
      const dow = date.getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
      if (dow >= 1 && dow <= 5) {
        counts[dow - 1] += r.absence_value
      }
    }
    const maxCount = Math.max(...counts, 1)
    // Blue gradient: light (#90caf9) to dark (#1565c0)
    const lightBlue = [144, 202, 249]
    const darkBlue = [21, 101, 192]
    return days.map((day, i) => {
      const ratio = counts[i] / maxCount
      const color = lightBlue.map((light, j) => Math.round(light + (darkBlue[j] - light) * ratio))
      return {
        label: day.label,
        full: day.full,
        count: counts[i],
        size: 32 + ratio * 26, // 32px min, 58px max
        color: counts[i] > 0 ? `rgb(${color.join(',')})` : undefined,
      }
    })
  }, [filteredRecords])

  const rows = filteredRecords.map((r, i) => ({ id: i, ...r }))

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flex: 1 }}>
          <Typography variant="h4">
            {student.student_first_name} {student.student_last_name}
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.disabled' }}>|</Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            {semesterFilter}
          </Typography>
          <Typography variant="h6" sx={{ color: 'text.disabled' }}>|</Typography>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            {isAllSelected ? 'All Classes' : isOneSelected ? selectedCourses[0] : 'Selected Classes'}
          </Typography>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'single'
            ? `Select a${semesterFilter === 'Full Year' ? '' : ` ${semesterFilter.toLowerCase()}`} class`
            : `Select${semesterFilter === 'Full Year' ? '' : ` ${semesterFilter.toLowerCase()}`} classes`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, pt: 1 }}>
            {semesterCourses.map((course) => (
              <Button
                key={course}
                variant={(dialogMode === 'multi' ? pendingCourses : selectedCourses).includes(course) ? 'contained' : 'outlined'}
                onClick={() => handleClassClick(course)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left', fontSize: '0.8rem' }}
              >
                {course}
              </Button>
            ))}
          </Box>
        </DialogContent>
        {dialogMode === 'multi' && (
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={applyMultiSelect} disabled={pendingCourses.length === 0}>
              Apply
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2, gap: 2, overflow: 'hidden' }}>
        {/* First row - Term | Issue 1 | Issue 2 | Days */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 2 }}>
          {/* Absences by Term */}
          <Box sx={{ borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
            {showHeadings && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
                  Absences by Term
                </Typography>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2.5 }}>
              {([
                { key: 'Fall' as const, label: 'Fall' },
                { key: 'Spring' as const, label: 'Spring' },
                { key: 'Full Year' as const, label: 'Year' },
              ]).map((t) => (
                <Box
                  key={t.key}
                  onClick={() => changeTerm(t.key)}
                  sx={{ ...toggleBtnSx(semesterFilter === t.key), flex: 1, textAlign: 'center' }}
                >
                  {t.label}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {([
                { key: 'Fall' as const, value: termTotals.fall },
                { key: 'Spring' as const, value: termTotals.spring },
                { key: 'Full Year' as const, value: termTotals.year },
              ]).map((t) => (
                <Box
                  key={t.key}
                  onClick={() => changeTerm(t.key)}
                  sx={{ flex: 1, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Typography sx={{
                    fontSize: '1.75rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    color: semesterFilter === t.key ? 'primary.main' : 'text.secondary',
                  }}>
                    {formatNum(t.value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right 3 panels */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, minWidth: 0 }}>
            {/* Notifications */}
            <Box sx={{ minWidth: 0 }}>
              <NotificationHistory
                studentFirstName={student.student_first_name}
                studentLastName={student.student_last_name}
                studentId={student.student_id}
                showHeadings={showHeadings}
              />
            </Box>

            {/* Issue Area 2 - placeholder */}
            <Box sx={{ minWidth: 0, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
              {showHeadings && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                  <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
                    Issue Area 2
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                </Box>
              )}
            </Box>

            {/* Absences by Day */}
            <Box sx={{ minWidth: 0, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
              {showHeadings && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                  <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
                    Absences by Day
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', minHeight: 70 }}>
                {dayOfWeekData.map((d, i) => (
                  <Tooltip key={i} title={d.full} arrow>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Box
                        sx={{
                          width: d.size,
                          height: d.size,
                          borderRadius: '50%',
                          backgroundColor: d.color || 'grey.300',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Typography sx={{
                          fontSize: d.size * 0.35,
                          fontWeight: 600,
                          color: '#fff',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {formatNum(d.count)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {d.label}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Second row */}
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 3fr', minHeight: 0, gap: 2 }}>
          <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Course list */}
          {courseData.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 0, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2, pr: 1, display: 'flex', flexDirection: 'column' }}>
              {showHeadings && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                  <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
                    Absences by Class
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, mb: 2.5 }}>
                <Box onClick={selectAllClasses} sx={{ ...toggleBtnSx(isAllSelected), flex: 1, textAlign: 'center' }}>All</Box>
                <Box onClick={openSingleSelect} sx={{ ...toggleBtnSx(isOneSelected), flex: 1, textAlign: 'center' }}>One</Box>
                <Box onClick={openMultiSelect} sx={{ ...toggleBtnSx(!isAllSelected && !isOneSelected), flex: 1, textAlign: 'center' }}>Some</Box>
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', pr: 2 }}>
                {(() => {
                  const maxVal = Math.max(...courseData.map(d => d.value), 1)
                  return courseData.map((d) => (
                    <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Box sx={{ width: 90, height: 14, backgroundColor: 'grey.200', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
                        <Box sx={{ width: `${(d.value / maxVal) * 100}%`, height: '100%', backgroundColor: getColor(d, 'threshold'), borderRadius: '2px' }} />
                      </Box>
                      <Tooltip title={d.name} arrow disableHoverListener={d.name.length < 25}>
                        <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
                      </Tooltip>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatNum(d.value)}
                      </Typography>
                    </Box>
                  ))
                })()}
              </Box>
            </Box>
          )}

          {/* Reason card */}
          <Box sx={{ px: 2, py: 1.5, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            {showHeadings && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
                <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
                  Absence Reasons
                </Typography>
                <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-around', mb: 1.5 }}>
              {statusData.sort((a, b) => b.value - a.value).map((d) => {
                const color = d.name.toLowerCase() === 'unexcused' ? COLOR_UNEXCUSED : COLOR_EXCUSED
                return (
                  <Box key={d.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '1.75rem', fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color }}>
                      {formatNum(d.value)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'lowercase' }}>
                      {d.name}
                    </Typography>
                  </Box>
                )
              })}
            </Box>
            {(() => {
              const sorted = [...reasonData].sort((a, b) => b.value - a.value)
              const maxVal = Math.max(...sorted.map(d => d.value), 1)
              return sorted.map((d) => (
                <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 90, height: 14, backgroundColor: 'grey.200', borderRadius: '2px', flexShrink: 0, overflow: 'hidden' }}>
                    <Box sx={{ width: `${(d.value / maxVal) * 100}%`, height: '100%', backgroundColor: getColor(d, reasonColorMode), borderRadius: '2px' }} />
                  </Box>
                  <Tooltip title={d.name} arrow disableHoverListener={d.name.length < 25}>
                    <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</Typography>
                  </Tooltip>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatNum(d.value)}
                  </Typography>
                </Box>
              ))
            })()}
          </Box>

        </Box>
        <Box sx={{ minHeight: 0, minWidth: 0 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            initialState={{
              sorting: { sortModel: [{ field: 'attendance_date', sort: 'desc' }] },
            }}
            sx={{ height: '100%' }}
          />
        </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default DrillDetail
