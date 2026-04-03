import { useState, useCallback, useEffect, useMemo } from 'react'
import { AppBar, Toolbar, Typography, Button, Box, TextField, IconButton } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import type { UpdateStatus } from '../shared/types'
import { DataGrid, GridColDef, GridRowParams } from '@mui/x-data-grid'
import type { StudentAbsence } from '../shared/types'
import { useStudentAbsences } from './hooks/useStudentAbsences'
import { useSync } from './hooks/useSync'
import DrillDetail from './components/DrillDetail'
import Settings from './components/Settings'
import { COLOR_WARN, COLOR_ORANGE, COLOR_DANGER } from './components/chartColors'

function formatNum(value: number): string {
  return value % 1 === 0.5 ? value.toFixed(1) : Math.round(value).toString()
}

type TermFilter = 'Full Year' | 'Fall' | 'Spring'

const toggleBtnSx = (active: boolean) => ({
  px: 1.5,
  py: 0.5,
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

const thresholdBtnSx = (active: boolean, color: string) => ({
  px: 1.5,
  py: 0.5,
  borderRadius: '4px',
  cursor: 'pointer',
  userSelect: 'none' as const,
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#fff' : 'text.secondary',
  backgroundColor: active ? color : 'grey.100',
  border: '1px solid',
  borderColor: active ? color : 'grey.300',
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: active ? color : 'grey.200',
  },
})

// Determine current term based on date (Aug-Dec = Fall, Jan-Jul = Spring)
function getCurrentTerm(): TermFilter {
  const month = new Date().getMonth() + 1
  return month >= 8 ? 'Fall' : 'Spring'
}

function App() {
  const { students, reload: reloadStudents } = useStudentAbsences()
  const [filter, setFilter] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentAbsence | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [termFilter, setTermFilter] = useState<TermFilter>(getCurrentTerm)

  // Get the appropriate max class value based on term filter
  const getMaxClassValue = useCallback((s: StudentAbsence) => {
    if (termFilter === 'Fall') return s.max_class_fall
    if (termFilter === 'Spring') return s.max_class_spring
    return s.max_class_absences
  }, [termFilter])

  // Columns need to be memoized with termFilter dependency for max_class
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Student',
      flex: 1,
      minWidth: 200,
      valueGetter: (_value: unknown, row: StudentAbsence) =>
        `${row.student_first_name} ${row.student_last_name}`,
      sortComparator: (a: string, b: string) => {
        const lastA = a.split(' ').slice(-1)[0]
        const lastB = b.split(' ').slice(-1)[0]
        return lastA.localeCompare(lastB) || a.localeCompare(b)
      },
    },
    {
      field: 'max_class_display',
      headerName: 'Class Max',
      width: 100,
      type: 'number',
      valueGetter: (_value: unknown, row: StudentAbsence) => {
        if (termFilter === 'Fall') return row.max_class_fall
        if (termFilter === 'Spring') return row.max_class_spring
        return row.max_class_absences
      },
      valueFormatter: (value: number | null) => value != null ? formatNum(value) : '',
    },
    {
      field: 'fall_absences',
      headerName: 'Fall',
      width: 80,
      type: 'number',
      valueFormatter: (value: number | null) => value != null ? formatNum(value) : '',
    },
    {
      field: 'spring_absences',
      headerName: 'Spring',
      width: 80,
      type: 'number',
      valueFormatter: (value: number | null) => value != null ? formatNum(value) : '',
    },
    {
      field: 'total_absences',
      headerName: 'Total',
      width: 80,
      type: 'number',
      valueFormatter: (value: number | null) => value != null ? formatNum(value) : '',
    },
  ], [termFilter])
  const [thresholdFilter, setThresholdFilter] = useState<number | null>(null)

  const { syncing, syncMessage, sync } = useSync(reloadStudents)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    window.electronAPI.onUpdateStatus(setUpdateStatus)
  }, [])

  const handleRowClick = useCallback((params: GridRowParams) => {
    const row = params.row as StudentAbsence & { id: number }
    setSelectedStudent(row)
  }, [])

  // Get the value based on current term filter
  const getTermValue = useCallback((s: StudentAbsence) => {
    if (termFilter === 'Fall') return s.fall_absences
    if (termFilter === 'Spring') return s.spring_absences
    return s.total_absences
  }, [termFilter])

  // Compute threshold counts
  const thresholdCounts = useMemo(() => {
    return {
      five: students.filter(s => getTermValue(s) >= 5).length,
      seven: students.filter(s => getTermValue(s) >= 7).length,
      nineFive: students.filter(s => getTermValue(s) >= 9.5).length,
    }
  }, [students, getTermValue])

  // Apply all filters
  const filtered = useMemo(() => {
    let result = students

    // Name filter
    if (filter) {
      result = result.filter((s) => {
        const name = `${s.student_first_name} ${s.student_last_name}`.toLowerCase()
        return name.includes(filter.toLowerCase())
      })
    }

    // Threshold filter
    if (thresholdFilter !== null) {
      result = result.filter((s) => getTermValue(s) >= thresholdFilter)
    }

    return result
  }, [students, filter, thresholdFilter, getTermValue])

  const rows = filtered.map((s, i) => ({ id: i, ...s }))

  const handleThresholdClick = (threshold: number) => {
    setThresholdFilter(thresholdFilter === threshold ? null : threshold)
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default">
        <Toolbar>
          {selectedStudent && (
            <Button variant="outlined" size="small" onClick={() => setSelectedStudent(null)} sx={{ mr: 2 }}>
              Return to Grid
            </Button>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Casady Attendance
          </Typography>
          {updateStatus?.status === 'available' && (
            <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary' }}>
              Update v{updateStatus.version} found...
            </Typography>
          )}
          {updateStatus?.status === 'error' && (
            <Typography variant="body2" sx={{ mr: 2, color: 'error.main' }}>
              Update error: {updateStatus.message || 'unknown'}
            </Typography>
          )}
          {updateStatus?.status === 'downloading' && (
            <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary' }}>
              Downloading update... {updateStatus.percent}%
            </Typography>
          )}
          {updateStatus?.status === 'ready' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              sx={{ mr: 2 }}
              onClick={() => window.electronAPI.installUpdate()}
            >
              Restart to Update
            </Button>
          )}
          {syncMessage && (
            <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary' }}>
              {syncMessage}
            </Typography>
          )}
          <Button variant="outlined" onClick={sync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Data'}
          </Button>
          <IconButton onClick={() => setShowSettings(true)} sx={{ ml: 1 }} title="Settings">
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {showSettings ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Settings onBack={() => setShowSettings(false)} onSave={reloadStudents} />
        </Box>
      ) : selectedStudent ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DrillDetail student={selectedStudent} />
        </Box>
      ) : (
        <>
          <Box sx={{ px: 2, pt: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Filter by name..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ width: 250 }}
            />

            {/* Term filter */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mr: 0.5 }}>Term:</Typography>
              {(['Fall', 'Spring', 'Full Year'] as const).map((term) => (
                <Box
                  key={term}
                  onClick={() => setTermFilter(term)}
                  sx={toggleBtnSx(termFilter === term)}
                >
                  {term === 'Full Year' ? 'Year' : term}
                </Box>
              ))}
            </Box>

            {/* Threshold quick links */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', mr: 0.5 }}>Threshold:</Typography>
              <Box
                onClick={() => handleThresholdClick(5)}
                sx={thresholdBtnSx(thresholdFilter === 5, COLOR_WARN)}
              >
                5+ ({thresholdCounts.five})
              </Box>
              <Box
                onClick={() => handleThresholdClick(7)}
                sx={thresholdBtnSx(thresholdFilter === 7, COLOR_ORANGE)}
              >
                7+ ({thresholdCounts.seven})
              </Box>
              <Box
                onClick={() => handleThresholdClick(9.5)}
                sx={thresholdBtnSx(thresholdFilter === 9.5, COLOR_DANGER)}
              >
                9.5+ ({thresholdCounts.nineFive})
              </Box>
            </Box>
          </Box>

          <Box sx={{ flex: 1, p: 2, minHeight: 0 }}>
            <DataGrid
              rows={rows}
              columns={columns}
              density="compact"
              disableColumnMenu={false}
              onRowClick={handleRowClick}
              sx={{ cursor: 'pointer' }}
              initialState={{
                sorting: { sortModel: [{ field: 'max_class_display', sort: 'desc' }] },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  )
}

export default App
