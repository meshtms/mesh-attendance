import { type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { getColor, type ColorMode, type ChartEntry } from './chartColors'

interface Props {
  title: ReactNode
  data: ChartEntry[]
  colorMode: ColorMode
  activeIndex: number | null
  onHover: (index: number | null) => void
  onItemClick?: (name: string) => void
  labelMode?: 'percent' | 'count'
}

function AbsenceSegmentBar({ title, data, colorMode, activeIndex, onHover, onItemClick, labelMode = 'percent' }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">No absences</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{total.toFixed(1)}</Typography>
      </Box>
      <Box
        onMouseLeave={() => onHover(null)}
        sx={{
          display: 'flex',
          height: 28,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {data.map((entry, i) => {
          const pct = (entry.value / total) * 100
          if (pct === 0) return null
          const isActive = activeIndex === i
          const isDimmed = activeIndex !== null && !isActive

          return (
            <Box
              key={i}
              onMouseEnter={() => onHover(i)}
              onClick={() => onItemClick?.(entry.name)}
              sx={{
                flex: `${pct} 0 36px`,
                backgroundColor: getColor(entry, colorMode),
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                transform: isActive ? 'scaleY(1.15)' : 'scaleY(1)',
                cursor: onItemClick ? 'pointer' : 'default',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 11,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {labelMode === 'count' ? entry.value.toFixed(1) : `${pct.toFixed(0)}%`}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default AbsenceSegmentBar
