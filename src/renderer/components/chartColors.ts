export const COLOR_OK = '#4caf50'
export const COLOR_WARN = '#fbc02d'
export const COLOR_ORANGE = '#ef6c00'
export const COLOR_DANGER = '#d32f2f'
export const COLOR_EXCUSED = '#1976d2'
export const COLOR_UNEXCUSED = '#b39ddb'

export type ColorMode = 'threshold' | 'excused'

export interface ChartEntry {
  name: string
  value: number
}

function getThresholdColor(value: number) {
  if (value >= 9.5) return COLOR_DANGER
  if (value >= 7) return COLOR_ORANGE
  if (value >= 5) return COLOR_WARN
  return COLOR_OK
}

function getExcusedColor(name: string) {
  const lower = name.toLowerCase()
  if (lower.includes('unexcused') || lower.includes('under review')) return COLOR_UNEXCUSED
  return COLOR_EXCUSED
}

export function getColor(entry: ChartEntry, colorMode: ColorMode) {
  return colorMode === 'excused' ? getExcusedColor(entry.name) : getThresholdColor(entry.value)
}
