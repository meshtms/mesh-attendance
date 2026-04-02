import { useState, useEffect } from 'react'
import { Box, Button, Typography, Checkbox, FormControlLabel } from '@mui/material'

interface Props {
  onBack: () => void
  onSave: () => void
}

function Settings({ onBack, onSave }: Props) {
  const [allReasons, setAllReasons] = useState<string[]>([])
  const [excludedReasons, setExcludedReasons] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

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
      </Box>
    </Box>
  )
}

export default Settings
