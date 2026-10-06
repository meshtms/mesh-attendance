import { useState, useEffect, useMemo } from 'react'
import { Box, Button, Typography, Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, ToggleButton, ToggleButtonGroup, Alert } from '@mui/material'
import { CATEGORY_TYPES } from '../../shared/types'
import type { CategoryInfo, CategoryType } from '../../shared/types'

interface Props {
  onBack: () => void
  onSave: () => void
}

// Reasons repeat across categories, so exclusions are keyed by the pair.
const key = (category: string, reason: string) => `${category}\x1F${reason}`

function Settings({ onBack, onSave }: Props) {
  const [tree, setTree] = useState<CategoryInfo[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [types, setTypes] = useState<Map<string, CategoryType>>(new Map())
  const [loading, setLoading] = useState(true)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.electronAPI.getCategoryTree(),
      window.electronAPI.getExcludedReasons(),
    ]).then(([categories, excludedReasons]) => {
      setTree(categories)
      setTypes(new Map(categories.map((c) => [c.category, c.type])))
      setExcluded(
        new Set(excludedReasons.map((e) => key(e.attendance_category, e.reason))),
      )
      setLoading(false)
    })
  }, [])

  const toggleReason = (category: string, reason: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      const k = key(category, reason)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const toggleCategory = (category: CategoryInfo, exclude: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const reason of category.reasons) {
        if (exclude) next.add(key(category.category, reason))
        else next.delete(key(category.category, reason))
      }
      return next
    })
  }

  const setCategoryType = (category: string, type: CategoryType) => {
    setTypes((prev) => new Map(prev).set(category, type))
  }

  const handleSave = async () => {
    await window.electronAPI.setCategoryTypes(
      [...types].map(([category, type]) => ({ category, type })),
    )
    await window.electronAPI.setExcludedReasons(
      [...excluded].map((k) => {
        const [attendance_category, reason] = k.split('\x1F')
        return { attendance_category, reason }
      }),
    )
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

  const totalReasons = useMemo(
    () => tree.reduce((sum, c) => sum + c.reasons.length, 0),
    [tree],
  )

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
        <Button variant="contained" onClick={handleSave} size="small" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {saveError && (
        <Alert severity="error" onClose={() => setSaveError(null)} sx={{ mx: 3, mb: 1 }}>
          Could not save settings. Your selections are still here, and nothing was
          changed. {saveError}
        </Alert>
      )}

      <Box sx={{ flex: 1, px: 3, py: 2, overflowY: 'auto' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Categories &amp; Reasons
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Each attendance category is bucketed as an absence or a tardy, and the two
          are counted separately everywhere in the app. Within a category, check any
          reason you want left out of that bucket's counts entirely. The same reason
          can appear under more than one category &mdash; each is set on its own.
        </Typography>

        {totalReasons === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No attendance categories found. Import attendance data first.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tree.map((category) => {
              const excludedCount = category.reasons.filter((r) =>
                excluded.has(key(category.category, r)),
              ).length
              const allExcluded =
                category.reasons.length > 0 && excludedCount === category.reasons.length

              return (
                <Box
                  key={category.category}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Checkbox
                      checked={allExcluded}
                      indeterminate={excludedCount > 0 && !allExcluded}
                      onChange={(e) => toggleCategory(category, e.target.checked)}
                      size="small"
                      disabled={category.reasons.length === 0}
                    />
                    <Typography sx={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
                      {category.category || '(no category)'}
                    </Typography>
                    <ToggleButtonGroup
                      value={types.get(category.category) ?? 'ABSENCE'}
                      exclusive
                      size="small"
                      onChange={(_e, value) => {
                        if (value) setCategoryType(category.category, value as CategoryType)
                      }}
                    >
                      {CATEGORY_TYPES.map((type) => (
                        <ToggleButton
                          key={type}
                          value={type}
                          sx={{ px: 1.5, py: 0.25, fontSize: 11, fontWeight: 600 }}
                        >
                          {type}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', pl: 4 }}>
                    {category.reasons.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
                        No reasons in the current data.
                      </Typography>
                    ) : (
                      category.reasons.map((reason) => (
                        <FormControlLabel
                          key={reason}
                          control={
                            <Checkbox
                              checked={excluded.has(key(category.category, reason))}
                              onChange={() => toggleReason(category.category, reason)}
                              size="small"
                            />
                          }
                          label={reason}
                          sx={{ '& .MuiFormControlLabel-label': { fontSize: 14 } }}
                        />
                      ))
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Reset Attendance Data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Delete all imported attendance records. Notifications, category types
            and excluded reasons are kept. Use this if duplicates have appeared,
            then re-sync from your CSV.
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
