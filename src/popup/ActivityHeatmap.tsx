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

export default function ActivityHeatmap({ log, rank }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [weeksCount, setWeeksCount] = useState(17)

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
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const start = new Date(todayUTC)
    start.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay() - 7 * (weeksCount - 1))

    const weeks: Array<Array<DayCell | null>> = []
    const monthLabels: Array<{ label: string; col: number }> = []
    let totalCount = 0

    for (let w = 0; w < weeksCount; w++) {
      const week: Array<DayCell | null> = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setUTCDate(start.getUTCDate() + w * 7 + d)
        if (date > todayUTC) {
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
    const startMonth = weeks[0][0]?.date.getUTCMonth() ?? -1
    let prevMonth = startMonth
    for (let w = 1; w < weeksCount; w++) {
      const sunday = weeks[w][0]
      if (!sunday) continue
      const m = sunday.date.getUTCMonth()
      if (m !== prevMonth) {
        monthLabels.push({
          label: sunday.date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
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
    const d = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
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
                  title={formatTooltip(day.count, day.date)}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    background: getColor(day.count),
                    borderRadius: '2px',
                  }}
                />
              ),
            ),
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
