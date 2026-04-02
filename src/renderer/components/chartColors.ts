export const WARN_THRESHOLD = 5
export const DANGER_THRESHOLD = 9

export const COLOR_OK = '#4caf50'
export const COLOR_WARN = '#fbc02d'
export const COLOR_DANGER = '#d32f2f'
export const COLOR_EXCUSED = '#1976d2'
export const COLOR_UNEXCUSED = '#ef6c00'

export type ColorMode = 'threshold' | 'excused'

export interface ChartEntry {
  name: string
  value: number
}

function getThresholdColor(value: number) {
  if (value >= DANGER_THRESHOLD) return COLOR_DANGER
  if (value >= WARN_THRESHOLD) return COLOR_WARN
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
