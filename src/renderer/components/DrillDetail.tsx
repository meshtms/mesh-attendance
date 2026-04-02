import { useState, useMemo, useCallback } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { useStudentRecords } from '../hooks/useStudentRecords'
import { getColor, COLOR_EXCUSED, COLOR_UNEXCUSED, type ChartEntry } from './chartColors'
import type { StudentAbsence, AbsenceRecord } from '../../shared/types'

interface Props {
  student: StudentAbsence
  onBack: () => void
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

const toggleBtnSx = (active: boolean) => ({
  px: 1.25,
  py: 0.25,
  borderRadius: '4px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'primary.main' : 'text.secondary',
  backgroundColor: active ? 'primary.50' : 'transparent',
  border: '1px solid',
  borderColor: active ? 'primary.200' : 'transparent',
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: active ? 'primary.50' : 'action.hover',
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

function DrillDetail({ student, onBack }: Props) {
  const { records: allRecords } = useStudentRecords(
    student.student_first_name,
    student.student_last_name,
  )

  const allCourses = useMemo(
    () => [...new Set(allRecords.map((r) => r.course))].sort(),
    [allRecords],
  )
  const allReasons = useMemo(
    () => [...new Set(allRecords.map((r) => r.reason))].sort(),
    [allRecords],
  )
  const allStatuses = useMemo(
    () => [...new Set(allRecords.map((r) => r.excused_unexcused))].sort(),
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

  const semesterFilters = useToggleSet(new Set())
  const courseFilters = useToggleSet(new Set())
  const reasonFilters = useToggleSet(new Set())
  const statusFilters = useToggleSet(new Set())

  const filteredRecords = useMemo(() => {
    let result = allRecords
    if (semesterFilters.selected.size === 1) {
      if (semesterFilters.selected.has('Fall'))
        result = result.filter((r) => r.attendance_date <= fallCutoff)
      else if (semesterFilters.selected.has('Spring'))
        result = result.filter((r) => r.attendance_date > fallCutoff)
    }
    if (courseFilters.selected.size > 0)
      result = result.filter((r) => courseFilters.selected.has(r.course))
    if (reasonFilters.selected.size > 0)
      result = result.filter((r) => reasonFilters.selected.has(r.reason))
    if (statusFilters.selected.size > 0)
      result = result.filter((r) => statusFilters.selected.has(r.excused_unexcused))
    return result
  }, [allRecords, fallCutoff, semesterFilters.selected, courseFilters.selected, reasonFilters.selected, statusFilters.selected])

  const courseData = useMemo(
    () => buildGroupData(filteredRecords, 'course').sort((a, b) => b.value - a.value),
    [filteredRecords],
  )
  const courseTotal = courseData.reduce((s, d) => s + d.value, 0)

  const reasonData = buildGroupData(filteredRecords, 'reason')
  const reasonColorMode = 'excused' as const
  const statusData = buildGroupData(filteredRecords, 'excused_unexcused')

  const rows = filteredRecords.map((r, i) => ({ id: i, ...r }))

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

      {/* Filter rows */}
      <Box sx={{ px: 3, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', width: 52, flexShrink: 0 }}>
            Semester
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {['Fall', 'Spring'].map((s) => (
              <Box key={s} onClick={() => semesterFilters.toggle(s)} sx={toggleBtnSx(semesterFilters.selected.has(s))}>
                {s}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', width: 52, flexShrink: 0 }}>
            Course
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {allCourses.map((c) => (
              <Box key={c} onClick={() => courseFilters.toggle(c)} sx={toggleBtnSx(courseFilters.selected.has(c))}>
                {c}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', width: 52, flexShrink: 0 }}>
            Reason
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {allReasons.map((r) => (
              <Box key={r} onClick={() => reasonFilters.toggle(r)} sx={toggleBtnSx(reasonFilters.selected.has(r))}>
                {r}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', width: 52, flexShrink: 0 }}>
            Status
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {allStatuses.map((s) => (
              <Box key={s} onClick={() => statusFilters.toggle(s)} sx={toggleBtnSx(statusFilters.selected.has(s))}>
                {s}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, p: 2, gap: 2 }}>
        <Box sx={{ flex: '0 0 60%', minWidth: 0 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            initialState={{
              sorting: { sortModel: [{ field: 'attendance_date', sort: 'desc' }] },
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {/* Course card: pie above, legend below */}
          {courseData.length > 0 && (
            <Box sx={{ flex: 1, minHeight: 0, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', p: 2 }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={courseData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="40%"
                      outerRadius="75%"
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={1}
                      isAnimationActive={false}
                    >
                      {courseData.map((entry, i) => (
                        <Cell key={i} fill={getColor(entry, 'threshold')} />
                      ))}
                      <Label
                        position="center"
                        content={() => (
                          <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                          >
                            <tspan x="50%" dy="-0.3em" style={{ fontSize: 20, fontWeight: 700, fill: '#222' }}>
                              {courseTotal.toFixed(1)}
                            </tspan>
                            <tspan x="50%" dy="1.4em" style={{ fontSize: 10, fontWeight: 500, fill: '#888' }}>
                              total
                            </tspan>
                          </text>
                        )}
                      />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ overflowY: 'auto', pt: 1 }}>
                {courseData.map((d) => (
                  <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: getColor(d, 'threshold'), flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{d.name}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {d.value.toFixed(1)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Reason card */}
          <Box sx={{ px: 2, py: 1.5, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            {reasonData
              .sort((a, b) => b.value - a.value)
              .map((d) => (
                <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: getColor(d, reasonColorMode), flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{d.name}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {d.value.toFixed(1)}
                  </Typography>
                </Box>
              ))}
            <Box sx={{ display: 'flex', height: 16, gap: '3px', mt: 1.5 }}>
              {reasonData
                .sort((a, b) => b.value - a.value)
                .map((d) => {
                  const total = reasonData.reduce((s, x) => s + x.value, 0)
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return pct > 0 ? (
                    <Box key={d.name} sx={{ width: `${pct}%`, backgroundColor: getColor(d, reasonColorMode), borderRadius: '2px' }} />
                  ) : null
                })}
            </Box>
          </Box>

          {/* Status card */}
          <Box sx={{ px: 2, py: 1.5, borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
            {statusData
              .sort((a, b) => b.value - a.value)
              .map((d) => {
                const color = d.name.toLowerCase() === 'unexcused' ? COLOR_UNEXCUSED : COLOR_EXCUSED
                return (
                  <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{d.name}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {d.value.toFixed(1)}
                    </Typography>
                  </Box>
                )
              })}
            <Box sx={{ display: 'flex', height: 16, gap: '3px', mt: 1.5 }}>
              {statusData
                .sort((a, b) => b.value - a.value)
                .map((d) => {
                  const total = statusData.reduce((s, x) => s + x.value, 0)
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  const color = d.name.toLowerCase() === 'unexcused' ? COLOR_UNEXCUSED : COLOR_EXCUSED
                  return pct > 0 ? (
                    <Box key={d.name} sx={{ width: `${pct}%`, backgroundColor: color, borderRadius: '2px' }} />
                  ) : null
                })}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default DrillDetail
