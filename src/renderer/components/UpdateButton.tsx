import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Fade, IconButton, Snackbar } from '@mui/material'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { UpdateStatus } from '../../shared/types'

/**
 * Header control for app updates. Normally an icon that checks for an update
 * on click; shows progress while checking or downloading, and turns into an
 * "Install Update" button once an update is ready to install.
 */
function UpdateButton() {
  const [state, setState] = useState<UpdateStatus | null>(null)
  // Toast under the header for the result of a check: success or failure.
  // Content is kept after closing so the fade-out doesn't flash a different toast.
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; text: string }>({ severity: 'success', text: '' })
  const [toastOpen, setToastOpen] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    // Subscribe first so nothing sent between the two calls is missed.
    const unsubscribe = window.electronAPI.onUpdateStatus(setState)
    window.electronAPI.getUpdateStatus().then((s) => setState((prev) => prev ?? s))
    window.electronAPI.getVersion().then(setVersion)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (state?.status === 'up-to-date') {
      setToast({ severity: 'success', text: `You're up to date${version ? ` (v${version})` : ''}` })
      setToastOpen(true)
    } else if (state?.status === 'error') {
      setToast({ severity: 'error', text: `Update failed: ${state.message ?? 'unknown error'}` })
      setToastOpen(true)
    }
    // version only fills in the text; a late-arriving version shouldn't re-open the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Toasts always fade on their own. Our own timer rather than Snackbar's
  // autoHideDuration, which pauses while hovered or while the window is blurred.
  useEffect(() => {
    if (!toastOpen) return
    const timer = setTimeout(() => setToastOpen(false), toast.severity === 'error' ? 6000 : 4000)
    return () => clearTimeout(timer)
  }, [toastOpen, toast])

  // The web build has no updates at all; nothing to show.
  if (!state || import.meta.env.MODE === 'web') return null

  // Dev and preview builds can't update themselves, but still show the button
  // (greyed out) so the header looks the same as in the installed app.
  if (state.status === 'disabled') {
    return (
      <span title="Updates are off in this build (dev or preview)">
        <IconButton disabled sx={{ ml: 1 }}>
          <SystemUpdateAltIcon />
        </IconButton>
      </span>
    )
  }

  if (state.status === 'ready') {
    return (
      <Button
        variant="contained"
        color="success"
        startIcon={<CheckCircleOutlineIcon />}
        onClick={() => window.electronAPI.installUpdate()}
        title={`Restart and install version ${state.version ?? ''}`.trim()}
        // Same size and type as the Sync Data button beside it.
        disableElevation
        sx={{ ml: 1, textTransform: 'none', fontWeight: 500 }}
      >
        Install Update
      </Button>
    )
  }

  const busy = state.status === 'checking' || state.status === 'available' || state.status === 'downloading'
  const title =
    state.status === 'checking' ? 'Checking for updates…'
    : state.status === 'available' ? `Downloading version ${state.version}…`
    : state.status === 'downloading' ? `Downloading version ${state.version ?? ''} (${state.percent ?? 0}%)…`
    : state.status === 'error' ? `Update failed: ${state.message ?? 'unknown error'}. Click to try again.`
    : 'Check for updates'

  return (
    <>
      <Snackbar
        open={toastOpen}
        slots={{ transition: Fade }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        // Just below the header bar, under the button group. '&&' outranks
        // Snackbar's own responsive top offset.
        sx={{ '&&': { top: 72, right: 16 } }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ alignItems: 'center', maxWidth: 480 }}
        >
          {toast.text}
        </Alert>
      </Snackbar>
      {/* The span keeps the tooltip working while the button is disabled. */}
      <span title={title}>
        <IconButton
          onClick={() => window.electronAPI.checkForUpdates()}
          disabled={busy}
          color={state.status === 'error' ? 'error' : 'default'}
          sx={{ ml: 1 }}
        >
          {busy ? (
            <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress
                size={20}
                variant={state.status === 'downloading' ? 'determinate' : 'indeterminate'}
                value={state.percent ?? 0}
              />
            </Box>
          ) : (
            <SystemUpdateAltIcon />
          )}
        </IconButton>
      </span>
    </>
  )
}

export default UpdateButton
