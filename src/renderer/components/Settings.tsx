import { useState, useEffect } from 'react'
import { Box, Button, Typography, Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'

interface Props {
  onBack: () => void
  onSave: () => void
}

function Settings({ onBack, onSave }: Props) {
  const [allReasons, setAllReasons] = useState<string[]>([])
  const [excludedReasons, setExcludedReasons] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getAllReasons(),
      window.electronAPI.getExcludedReasons(),
    ]).then(([reasons, excluded]) => {
      setAllReasons(reasons)
      setExcludedReasons(new Set(excluded))
      setLoading(false)
    })
  }, [])

  const toggleReason = (reason: string) => {
    setExcludedReasons((prev) => {
      const next = new Set(prev)
      if (next.has(reason)) next.delete(reason)
      else next.add(reason)
      return next
    })
  }

  const handleSave = async () => {
    await window.electronAPI.setExcludedReasons([...excludedReasons])
    onSave()
    onBack()
  }

  const handleClearAttendance = async () => {
    setClearing(true)
    try {
      await window.electronAPI.clearAttendance()
      onSave()
    } finally {
      setClearing(false)
      setConfirmClearOpen(false)
      onBack()
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, pt: 2, pb: 1 }}>
        <Button variant="outlined" onClick={onBack} size="small">
          Cancel
        </Button>
        <Typography variant="h6">Settings</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={handleSave} size="small">
          Save
        </Button>
      </Box>

      <Box sx={{ flex: 1, px: 3, py: 2, overflowY: 'auto' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Excluded Absence Reasons
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select reasons to exclude from all absence counts and reports. These absences will not be included in the main grid totals or student detail pages.
        </Typography>

        {allReasons.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No absence reasons found. Import attendance data first.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {allReasons.map((reason) => (
              <FormControlLabel
                key={reason}
                control={
                  <Checkbox
                    checked={excludedReasons.has(reason)}
                    onChange={() => toggleReason(reason)}
                    size="small"
                  />
                }
                label={reason}
                sx={{ '& .MuiFormControlLabel-label': { fontSize: 14 } }}
              />
            ))}
          </Box>
        )}

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Reset Attendance Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Delete all imported attendance records. Notifications and excluded
            reasons are kept. Use this if duplicates have appeared, then re-sync
            from your CSV.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => setConfirmClearOpen(true)}
          >
            Clear Attendance Data
          </Button>
        </Box>
      </Box>

      <Dialog open={confirmClearOpen} onClose={() => !clearing && setConfirmClearOpen(false)}>
        <DialogTitle>Clear all attendance data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete every imported attendance record. You
            will need to re-sync from your CSV afterward. Notifications will not
            be affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)} disabled={clearing}>
            Cancel
          </Button>
          <Button onClick={handleClearAttendance} color="error" disabled={clearing}>
            {clearing ? 'Clearing...' : 'Clear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Settings
