import { useRef, useState } from 'react'
import {
  Button,
  ButtonGroup,
  ClickAwayListener,
  Grow,
  Paper,
  Popper,
  MenuItem,
  MenuList,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import SyncIcon from '@mui/icons-material/Sync'
import RefreshIcon from '@mui/icons-material/Refresh'

interface Props {
  syncing: boolean
  onSync: () => void
  onRefresh: () => void
}

function SyncButton({ syncing, onSync, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => setOpen((prev) => !prev)

  const handleClose = (event: Event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target as HTMLElement)) {
      return
    }
    setOpen(false)
  }

  const handleRefreshClick = () => {
    setOpen(false)
    setConfirmOpen(true)
  }

  const handleConfirmRefresh = () => {
    setConfirmOpen(false)
    onRefresh()
  }

  return (
    <>
      <ButtonGroup
        variant="contained"
        ref={anchorRef}
        disabled={syncing}
        sx={{ boxShadow: 'none' }}
      >
        <Button
          onClick={onSync}
          startIcon={<SyncIcon sx={{ animation: syncing ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '100%': { transform: 'rotate(360deg)' } } }} />}
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {syncing ? 'Syncing...' : 'Sync Data'}
        </Button>
        <Button
          size="small"
          onClick={handleToggle}
          aria-controls={open ? 'sync-split-menu' : undefined}
          aria-haspopup="menu"
          sx={{ px: 0.5, minWidth: 32 }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        transition
        disablePortal
        placement="bottom-end"
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: 'right top' }}>
            <Paper elevation={4} sx={{ mt: 0.5 }}>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList id="sync-split-menu" autoFocusItem dense>
                  <MenuItem onClick={() => { setOpen(false); onSync() }}>
                    <SyncIcon fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
                    Sync Data
                  </MenuItem>
                  <MenuItem onClick={handleRefreshClick}>
                    <RefreshIcon fontSize="small" sx={{ mr: 1.5, color: 'error.main' }} />
                    Refresh Data
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Refresh attendance data?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will delete every existing attendance record and reload from
            the CSV you select next. Use this when data has gotten out of sync
            or duplicates have appeared. Notifications will not be affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRefresh} color="error" variant="contained">
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default SyncButton
