import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { DatasetList } from '../../shared/types'
import { errorMessage } from '../errorMessage'

interface Props {
  list: DatasetList
  onChange: (list: DatasetList) => void
}

type DialogKind = 'new' | 'rename' | 'delete' | null

// Sentinel for "start with default settings" in the copy-from picker.
const NO_COPY = ''

/** Top-bar picker for the open dataset, plus create / rename / delete. */
function DatasetSwitcher({ list, onChange }: Props) {
  const current = list.datasets.find((d) => d.id === list.currentId)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState(NO_COPY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openDialog = (kind: DialogKind) => {
    setAnchor(null)
    setError(null)
    setName(kind === 'rename' ? current?.name ?? '' : '')
    // New datasets usually want the same categories/exclusions as the one
    // being looked at (Upper -> Middle), so offer that by default.
    setCopyFrom(list.currentId)
    setDialog(kind)
  }

  const run = async (action: () => Promise<DatasetList>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setDialog(null)
      onChange(next)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSwitch = (id: string) => {
    setAnchor(null)
    if (id !== list.currentId) run(() => window.electronAPI.switchDataset(id))
  }

  const submit = () => {
    if (dialog === 'new') {
      run(() => window.electronAPI.createDataset(name, copyFrom || undefined))
    } else if (dialog === 'rename') {
      run(() => window.electronAPI.renameDataset(list.currentId, name))
    } else if (dialog === 'delete') {
      run(() => window.electronAPI.deleteDataset(list.currentId))
    }
  }

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ArrowDropDownIcon />}
        disabled={busy}
        title="Switch dataset"
        // Reads as the end of the title ("Casady Attendance for Upper Division"),
        // in the primary color so it still looks clickable.
        sx={{ typography: 'h6', textTransform: 'none', color: 'primary.main', ml: 0.25, px: 0.75, minWidth: 0 }}
      >
        {current?.name ?? 'Dataset'}
      </Button>

      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {list.datasets.map((d) => (
          <MenuItem key={d.id} onClick={() => handleSwitch(d.id)} selected={d.id === list.currentId}>
            <ListItemIcon>{d.id === list.currentId && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{d.name}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => openDialog('new')}>
          <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>New dataset…</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openDialog('rename')}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Rename “{current?.name}”…</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openDialog('delete')} disabled={list.datasets.length === 1}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete “{current?.name}”…</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={dialog !== null} onClose={() => !busy && setDialog(null)} fullWidth maxWidth="xs">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <DialogTitle>
            {dialog === 'new' && 'New dataset'}
            {dialog === 'rename' && 'Rename dataset'}
            {dialog === 'delete' && `Delete “${current?.name}”?`}
          </DialogTitle>
          <DialogContent>
            {dialog === 'delete' ? (
              <DialogContentText>
                This permanently deletes this dataset's attendance records,
                settings and notifications. Other datasets are not affected.
                This cannot be undone.
              </DialogContentText>
            ) : (
              <>
                {dialog === 'new' && (
                  <DialogContentText sx={{ mb: 2 }}>
                    A dataset keeps its own attendance, settings and notifications,
                    separate from every other dataset. Import its CSV after creating it.
                  </DialogContentText>
                )}
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  label="Name"
                  placeholder="e.g. Upper School"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ mt: 1 }}
                />
                {dialog === 'new' && (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Start with settings from"
                    value={copyFrom}
                    onChange={(e) => setCopyFrom(e.target.value)}
                    helperText="Copies category types and excluded reasons only. They can be changed independently afterward."
                    sx={{ mt: 2 }}
                  >
                    <MenuItem value={NO_COPY}>Nothing (defaults)</MenuItem>
                    {list.datasets.map((d) => (
                      <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              </>
            )}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              color={dialog === 'delete' ? 'error' : 'primary'}
              disabled={busy || (dialog !== 'delete' && !name.trim())}
            >
              {dialog === 'new' && 'Create'}
              {dialog === 'rename' && 'Rename'}
              {dialog === 'delete' && 'Delete'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}

export default DatasetSwitcher
