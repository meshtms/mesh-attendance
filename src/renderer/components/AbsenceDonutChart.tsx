import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts'
import { Typography, Box } from '@mui/material'
import { getColor, type ColorMode, type ChartEntry } from './chartColors'
import AbsenceLegend from './AbsenceLegend'

interface Props {
  title: string
  data: ChartEntry[]
  onItemClick?: (name: string) => void
  colorMode?: ColorMode
  chartRatio?: string
  layout?: 'horizontal' | 'vertical'
}

function AbsenceDonutChart({ title, data, onItemClick, colorMode = 'threshold', chartRatio = '55%', layout = 'horizontal' }: Props) {
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

  const total = nonZero.reduce((sum, d) => sum + d.value, 0)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: layout === 'vertical' ? 'column' : 'row', alignItems: layout === 'vertical' ? 'center' : 'flex-start' }}>
        <Box sx={layout === 'vertical'
          ? { width: '60%', aspectRatio: '1', maxHeight: '60%' }
          : { flex: `0 0 ${chartRatio}`, aspectRatio: '1', maxHeight: '100%' }
        }>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart onMouseLeave={() => setActiveIndex(null)}>
              <Pie
                data={nonZero}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="75%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={1}
                isAnimationActive={false}
              >
                {nonZero.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={getColor(entry, colorMode)}
                    opacity={activeIndex !== null && activeIndex !== i ? 0.3 : 1}
                    style={{ transition: 'opacity 0.2s ease', cursor: onItemClick ? 'pointer' : 'default' }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => onItemClick?.(entry.name)}
                  />
                ))}
                <Label
                  position="center"
                  content={() => (
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      <tspan x="50%" dy="-0.6em" style={{ fontSize: 28, fontWeight: 700, fill: '#222' }}>
                        {total.toFixed(1)}
                      </tspan>
                      <tspan x="50%" dy="1.6em" style={{ fontSize: 13, fontWeight: 500, fill: '#888' }}>
                        {title}
                      </tspan>
                    </text>
                  )}
                />
              </Pie>
              {activeIndex !== null && (
                <Pie
                  data={nonZero}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="36%"
                  outerRadius="80%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={1}
                  isAnimationActive={false}
                  style={{ pointerEvents: 'none' }}
                >
                  {nonZero.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={getColor(entry, colorMode)}
                      fillOpacity={i === activeIndex ? 1 : 0}
                      strokeWidth={0}
                      style={{ pointerEvents: 'none', filter: i === activeIndex ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none' }}
                    />
                  ))}
                </Pie>
              )}
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', width: layout === 'vertical' ? '100%' : 'auto', pr: layout === 'vertical' ? 0 : 2, pt: layout === 'vertical' ? 1 : 0 }}>
          <AbsenceLegend
            data={nonZero}
            colorMode={colorMode}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            onItemClick={onItemClick}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default AbsenceDonutChart
