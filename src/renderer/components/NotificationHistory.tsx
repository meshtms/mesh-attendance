import { useState } from 'react'
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useNotifications } from '../hooks/useNotifications'
import type { NewNotification } from '../../shared/types'

interface Props {
  studentFirstName: string
  studentLastName: string
  studentId?: string
  showHeadings?: boolean
}

const THRESHOLDS = [
  { value: 5, label: '5 absences' },
  { value: 7, label: '7 absences' },
  { value: 9.5, label: '9.5 absences' },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export default function NotificationHistory({ studentFirstName, studentLastName, studentId, showHeadings = true }: Props) {
  const { notifications, add, remove } = useNotifications(studentFirstName, studentLastName)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notificationDate, setNotificationDate] = useState(getTodayStr())
  const [thresholdValue, setThresholdValue] = useState<number>(5)
  const [comment, setComment] = useState('')

  const handleAdd = async () => {
    const notification: NewNotification = {
      student_first_name: studentFirstName,
      student_last_name: studentLastName,
      student_id: studentId,
      notification_date: notificationDate,
      threshold_value: thresholdValue,
      comment: comment.trim() || undefined,
    }
    await add(notification)
    setDialogOpen(false)
    setNotificationDate(getTodayStr())
    setThresholdValue(5)
    setComment('')
  }

  const handleDelete = async (id: number) => {
    if (confirm('Delete this notification record?')) {
      await remove(id)
    }
  }

  return (
    <Box sx={{ borderRadius: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
      {showHeadings && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
          <Typography variant="h6" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '1rem' }}>
            Notifications
          </Typography>
          <Box sx={{ flex: 1, height: '1px', backgroundColor: 'divider' }} />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add
        </Button>
      </Box>

      {notifications.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
          No notifications recorded
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {notifications.map((n) => (
            <Box
              key={n.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1,
                borderRadius: 1,
                backgroundColor: 'grey.50',
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatDate(n.notification_date)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    - {n.threshold_value} absences
                  </Typography>
                </Box>
                {n.comment && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {n.comment}
                  </Typography>
                )}
              </Box>
              <IconButton size="small" onClick={() => handleDelete(n.id)} sx={{ color: 'error.main' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Notification Record</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={notificationDate}
              onChange={(e) => setNotificationDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Threshold"
              select
              value={thresholdValue}
              onChange={(e) => setThresholdValue(Number(e.target.value))}
              fullWidth
            >
              {THRESHOLDS.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
