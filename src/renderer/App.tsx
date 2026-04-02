import { useState, useCallback, useEffect } from 'react'
import { AppBar, Toolbar, Typography, Button, Box, TextField } from '@mui/material'
import type { UpdateStatus } from '../shared/types'
import { DataGrid, GridColDef, GridRowParams } from '@mui/x-data-grid'
import type { StudentAbsence } from '../shared/types'
import { useStudentAbsences } from './hooks/useStudentAbsences'
import { useSync } from './hooks/useSync'
import DrillDetail from './components/DrillDetail'

const columns: GridColDef[] = [
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
    field: 'fall_absences',
    headerName: 'Fall',
    width: 120,
    type: 'number',
    valueFormatter: (value: number | null) => value != null ? value.toFixed(1) : '',
  },
  {
    field: 'spring_absences',
    headerName: 'Spring',
    width: 120,
    type: 'number',
    valueFormatter: (value: number | null) => value != null ? value.toFixed(1) : '',
  },
  {
    field: 'total_absences',
    headerName: 'Total',
    width: 120,
    type: 'number',
    valueFormatter: (value: number | null) => value != null ? value.toFixed(1) : '',
  },
]

function App() {
  const { students, reload: reloadStudents } = useStudentAbsences()
  const [filter, setFilter] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentAbsence | null>(null)

  const { syncing, syncMessage, sync } = useSync(reloadStudents)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    window.electronAPI.onUpdateStatus(setUpdateStatus)
  }, [])

  const handleRowClick = useCallback((params: GridRowParams) => {
    const row = params.row as StudentAbsence & { id: number }
    setSelectedStudent(row)
  }, [])

  const filtered = filter
    ? students.filter((s) => {
        const name = `${s.student_first_name} ${s.student_last_name}`.toLowerCase()
        return name.includes(filter.toLowerCase())
      })
    : students

  const rows = filtered.map((s, i) => ({ id: i, ...s }))

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default">
        <Toolbar>
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
              Update error
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
        </Toolbar>
      </AppBar>

      {selectedStudent ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DrillDetail
            student={selectedStudent}
            onBack={() => setSelectedStudent(null)}
          />
        </Box>
      ) : (
        <>
          <Box sx={{ px: 2, pt: 2 }}>
            <TextField
              size="small"
              placeholder="Filter by name..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ width: 300 }}
            />
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
                sorting: { sortModel: [{ field: 'total_absences', sort: 'desc' }] },
              }}
            />
          </Box>
        </>
      )}
    </Box>
  )
}

export default App
