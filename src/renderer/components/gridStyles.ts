import type { SxProps, Theme } from '@mui/material'
import { COLOR_WARN, COLOR_ORANGE, COLOR_DANGER } from './chartColors'

// The main grid is split into two vertical bands so absences and tardies read
// as separate sets of numbers rather than one run of digits.
export interface GridBand {
  id: string
  accent: string
  tint: string
  tintActive: string
}

export const GROUP_ABSENCE: GridBand = {
  id: 'absences',
  accent: '#5f6b7a',
  tint: 'rgba(96, 125, 160, 0.05)',
  tintActive: 'rgba(96, 125, 160, 0.12)',
}

export const GROUP_TARDY: GridBand = {
  id: 'tardies',
  accent: '#1565c0',
  tint: 'rgba(21, 101, 192, 0.05)',
  tintActive: 'rgba(21, 101, 192, 0.12)',
}

/** Absence thresholds shared with the quick-filter buttons: 5 / 7 / 9.5. */
export function thresholdColor(value: number): string {
  if (value >= 9.5) return COLOR_DANGER
  if (value >= 7) return COLOR_ORANGE
  if (value >= 5) return COLOR_WARN
  return 'transparent'
}

const band = (b: GridBand) => ({
  [`& .band-${b.id}`]: {
    backgroundColor: b.tint,
  },
  [`& .band-${b.id}.band-active`]: {
    backgroundColor: b.tintActive,
  },
  [`& .band-${b.id}.band-head`]: {
    backgroundColor: b.tintActive,
    color: b.accent,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontSize: 11,
  },
})

export const gridSx: SxProps<Theme> = {
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  backgroundColor: '#fff',
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#fbfbfc',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    fontWeight: 600,
  },
  // Separator between the two bands, drawn on the first column of each.
  '& .band-tardies[data-field="fall_tardies"], & .MuiDataGrid-columnHeader.band-tardies[data-field="fall_tardies"]':
    {
      borderLeft: '1px solid rgba(0, 0, 0, 0.12)',
    },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within':
    {
      outline: 'none',
    },
  ...band(GROUP_ABSENCE),
  ...band(GROUP_TARDY),
}
