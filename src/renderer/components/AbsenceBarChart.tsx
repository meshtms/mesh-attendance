import { type ReactNode, useState, useMemo } from 'react'
import { Typography, Box } from '@mui/material'
import { type ColorMode, type ChartEntry } from './chartColors'
import AbsenceLegend from './AbsenceLegend'
import AbsenceSegmentBar from './AbsenceSegmentBar'

interface Props {
  title: ReactNode
  data: ChartEntry[]
  onItemClick?: (name: string) => void
  colorMode?: ColorMode
  labelMode?: 'percent' | 'count'
  hideLegend?: boolean
}

function AbsenceBarChart({ title, data, onItemClick, colorMode = 'threshold', labelMode = 'percent', hideLegend = false }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const nonZero = useMemo(
    () => data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [data],
  )

  if (nonZero.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">No absences</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1, pb: 1 }}>
        <AbsenceSegmentBar
          title={title}
          data={nonZero}
          colorMode={colorMode}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onItemClick={onItemClick}
          labelMode={labelMode}
        />
      </Box>
      {!hideLegend && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <AbsenceLegend
            data={nonZero}
            colorMode={colorMode}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            onItemClick={onItemClick}
          />
        </Box>
      )}
    </Box>
  )
}

export default AbsenceBarChart
