import { Typography, Box } from '@mui/material'
import { getColor, type ColorMode, type ChartEntry } from './chartColors'

interface Props {
  data: ChartEntry[]
  colorMode: ColorMode
  activeIndex: number | null
  onHover: (index: number | null) => void
  onItemClick?: (name: string) => void
}

function AbsenceLegend({ data, colorMode, activeIndex, onHover, onItemClick }: Props) {
  return (
    <>
      {data.map((entry, i) => (
        <Box
          key={i}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onItemClick?.(entry.name)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 0.75,
            px: 1,
            borderRadius: 1,
            cursor: onItemClick ? 'pointer' : 'default',
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: activeIndex === i ? 'action.hover' : 'transparent',
            transition: 'background-color 0.15s ease',
            '&:last-child': { borderBottom: 'none' },
          }}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              flexShrink: 0,
              borderRadius: '3px',
              backgroundColor: getColor(entry, colorMode),
            }}
          />
          <Typography variant="body2" sx={{ flex: 1, fontWeight: activeIndex === i ? 600 : 400 }}>
            {entry.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: getColor(entry, colorMode),
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {entry.value.toFixed(1)}
          </Typography>
        </Box>
      ))}
    </>
  )
}

export default AbsenceLegend
