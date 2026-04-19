import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dateISO, type ActivityLog } from '../shared/activity'
import type { Rank } from '../shared/points'

const CELL_SIZE = 10
const CELL_GAP = 2
const COLUMN = CELL_SIZE + CELL_GAP
const MIN_WEEKS = 8
const MAX_WEEKS = 53

interface DayCell {
  date: Date
  iso: string
  count: number
}

interface Props {
  log: ActivityLog
  rank: Rank
}

interface HoverState {
  count: number
  date: Date
  col: number
  row: number
}

export default function ActivityHeatmap({ log, rank }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [weeksCount, setWeeksCount] = useState(17)
  const [hover, setHover] = useState<HoverState | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const width = el.getBoundingClientRect().width
      if (width <= 0) return
      const n = Math.floor((width + CELL_GAP) / COLUMN)
      const clamped = Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, n))
      setWeeksCount((prev) => (prev === clamped ? prev : clamped))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { weeks, monthLabels, totalCount } = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() - 7 * (weeksCount - 1))

    const weeks: Array<Array<DayCell | null>> = []
    const monthLabels: Array<{ label: string; col: number }> = []
    let totalCount = 0

    for (let w = 0; w < weeksCount; w++) {
      const week: Array<DayCell | null> = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(start.getDate() + w * 7 + d)
        if (date > today) {
          week.push(null)
        } else {
          const iso = dateISO(date)
          const count = log[iso]?.count ?? 0
          totalCount += count
          week.push({ date, iso, count })
        }
      }
      weeks.push(week)
    }

    // Month labels: skip col 0 (start edge), label each subsequent month transition
    // at the Sunday where the month changes.
    const startMonth = weeks[0][0]?.date.getMonth() ?? -1
    let prevMonth = startMonth
    for (let w = 1; w < weeksCount; w++) {
      const sunday = weeks[w][0]
      if (!sunday) continue
      const m = sunday.date.getMonth()
      if (m !== prevMonth) {
        monthLabels.push({
          label: sunday.date.toLocaleString('en-US', { month: 'short' }),
          col: w,
        })
        prevMonth = m
      }
    }

    return { weeks, monthLabels, totalCount }
  }, [log, weeksCount])

  function getColor(count: number): string {
    if (count === 0) return '#eef2f6'
    if (count <= 2) return `${rank.accent}33`
    if (count <= 5) return `${rank.accent}66`
    if (count <= 9) return `${rank.accent}aa`
    return rank.accent
  }

  function formatTooltip(count: number, date: Date): string {
    const d = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (count === 0) return `No practice · ${d}`
    return `${count} sentence${count === 1 ? '' : 's'} · ${d}`
  }

  const gridWidth = weeksCount * COLUMN - CELL_GAP

  return (
    <div ref={containerRef} style={{ marginBottom: '18px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Practice activity
        </span>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          {totalCount} in {weeksCount}w
        </span>
      </div>

      <div style={{ width: `${gridWidth}px` }}>
        <div style={{ position: 'relative', height: '12px', marginBottom: '3px' }}>
          {monthLabels.map(({ label, col }) => (
            <span
              key={`${label}-${col}`}
              style={{
                position: 'absolute',
                left: `${col * COLUMN}px`,
                fontSize: '10px',
                color: '#9ca3af',
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <div style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${weeksCount}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
          gridAutoFlow: 'column',
          gap: `${CELL_GAP}px`,
        }}>
          {weeks.flatMap((week, w) =>
            week.map((day, d) =>
              day === null ? (
                <div key={`${w}-${d}`} style={{ background: 'transparent' }} />
              ) : (
                <div
                  key={`${w}-${d}`}
                  onMouseEnter={() => setHover({ count: day.count, date: day.date, col: w, row: d })}
                  onMouseLeave={() => setHover((h) => (h && h.col === w && h.row === d ? null : h))}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    background: getColor(day.count),
                    borderRadius: '2px',
                    outline: hover && hover.col === w && hover.row === d ? `1.5px solid ${rank.accent}` : 'none',
                    outlineOffset: '1px',
                  }}
                />
              ),
            ),
          )}
          {hover && (
            <div style={{
              position: 'absolute',
              left: `${hover.col * COLUMN + CELL_SIZE / 2}px`,
              top: `${hover.row * COLUMN - 8}px`,
              transform: 'translate(-50%, -100%)',
              background: '#111827',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 500,
              padding: '5px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 10,
            }}>
              {formatTooltip(hover.count, hover.date)}
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '8px',
        fontSize: '10px',
        color: '#9ca3af',
      }}>
        <span>Less</span>
        {[0, 1, 3, 6, 10].map((n) => (
          <span
            key={n}
            style={{
              width: `${CELL_SIZE}px`,
              height: `${CELL_SIZE}px`,
              background: getColor(n),
              borderRadius: '2px',
              display: 'inline-block',
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
