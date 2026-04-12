import { useEffect, useState } from 'react'
import { DEFAULT_POINTS_STATE, getRank, normalizePointsState, type PointsState } from '../shared/points'

const DENSITY_LABELS: Record<number, string> = {
  0: 'Off',
  0.25: '1/4',
  0.5: '1/2',
  0.75: '3/4',
}

interface Stats {
  translated: number
  total: number
}

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'ZH', label: 'Chinese' },
  { code: 'FR', label: 'French' },
  { code: 'JA', label: 'Japanese' },
  { code: 'KO', label: 'Korean' },
  { code: 'RU', label: 'Russian' },
  { code: 'ES', label: 'Spanish' },
]

export default function App() {
  const [density, setDensity] = useState(0)
  const [language, setLanguage] = useState('FR')
  const [stats, setStats] = useState<Stats | null>(null)
  const [pointsTotal, setPointsTotal] = useState(DEFAULT_POINTS_STATE.pointsTotal)
  const [showPointsOverlay, setShowPointsOverlay] = useState(DEFAULT_POINTS_STATE.showPointsOverlay)
  const [streakDays, setStreakDays] = useState(DEFAULT_POINTS_STATE.streakDays)

  useEffect(() => {
    chrome.storage.sync.get(['density', 'lang'], ({ density = 0, lang = 'FR' }) => {
      setDensity(density as number)
      setLanguage(lang as string)
    })
    chrome.runtime.sendMessage({ type: 'GET_POINTS_STATE' })
      .then((state) => {
        const nextState = normalizePointsState(state as Partial<PointsState>)
        setPointsTotal(nextState.pointsTotal)
        setShowPointsOverlay(nextState.showPointsOverlay)
        setStreakDays(nextState.streakDays)
      })
      .catch(() => {})
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' })
          .then((res) => setStats(res as Stats))
          .catch(() => {})
      }
    })

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'sync') return
      if (changes.pointsTotal) setPointsTotal((changes.pointsTotal.newValue as number | undefined) ?? 0)
      if (changes.showPointsOverlay) setShowPointsOverlay((changes.showPointsOverlay.newValue as boolean | undefined) ?? false)
      if (changes.streakDays) setStreakDays((changes.streakDays.newValue as number | undefined) ?? 0)
    }

    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value
    setLanguage(lang)
    chrome.storage.sync.set({ lang })
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id == null) return
      chrome.tabs.sendMessage(tab.id, { type: 'SET_LANG', lang })
        .then((res) => { if (res != null) setStats(res as Stats) })
        .catch(() => {})
    })
  }

  function handleDensityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    setDensity(value)
    chrome.storage.sync.set({ density: value })
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id == null) return
      chrome.tabs.sendMessage(tab.id, { type: 'SET_DENSITY', density: value })
        .then((res) => { if (res != null) setStats(res as Stats) })
        .catch(() => {})
    })
  }

  function handlePointsOverlayToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const show = e.target.checked
    setShowPointsOverlay(show)
    chrome.runtime.sendMessage({ type: 'SET_POINTS_OVERLAY', show })
      .then((state) => {
        const nextState = normalizePointsState(state as Partial<PointsState>)
        setPointsTotal(nextState.pointsTotal)
        setShowPointsOverlay(nextState.showPointsOverlay)
        setStreakDays(nextState.streakDays)
      })
      .catch(() => setShowPointsOverlay(!show))
  }

  const pct = density === 0 ? 'Off' : `${Math.round(density * 100)}%`
  const { rank, next, progress } = getRank(pointsTotal)

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      width: '300px',
      padding: '18px',
      boxSizing: 'border-box',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '18px', fontWeight: 400, color: '#111827', lineHeight: 1.2 }}>Langblock</div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Block-level language immersion</div>
      </div>

      {/* Language */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Language
        </label>
        <div style={{ position: 'relative' }}>
          <select
            value={language}
            onChange={handleLanguageChange}
            style={{
              width: '100%',
              padding: '8px 32px 8px 12px',
              fontSize: '14px',
              color: '#111827',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {LANGUAGES.map(({ code, label }) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <svg
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}
            width="14" height="14" viewBox="0 0 16 16" fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Points / Rank */}
      <div style={{ marginBottom: '10px', padding: '12px 14px', borderRadius: '10px', background: rank.bg, border: `1px solid ${rank.border}` }}>
        {/* Top row: rank name + streak badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: rank.accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {rank.name}
          </span>
          {streakDays > 0 ? (
            <span style={{
              fontSize: '12px', fontWeight: 600, color: rank.accent,
              border: `1.5px solid ${rank.border}`, borderRadius: '6px',
              padding: '2px 7px', lineHeight: 1,
            }}>
              🔥 {streakDays}
            </span>
          ) : (
            <span style={{
              fontSize: '12px', fontWeight: 500, color: '#9ca3af',
              border: '1.5px solid #e5e7eb', borderRadius: '6px',
              padding: '2px 7px', lineHeight: 1,
            }}>
              –
            </span>
          )}
        </div>

        {/* Points total */}
        <div style={{ fontSize: '26px', fontWeight: 700, color: rank.text, lineHeight: 1, marginBottom: '10px' }}>
          {pointsTotal.toLocaleString()} pts
        </div>

        {/* Progress to next rank */}
        {next ? (
          <>
            <div style={{ height: '4px', borderRadius: '999px', background: rank.border, overflow: 'hidden', marginBottom: '5px' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(2, progress * 100)}%`,
                borderRadius: '999px',
                background: rank.accent,
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: rank.accent, opacity: 0.75 }}>
              {(next.minPoints - pointsTotal).toLocaleString()} pts to {next.name}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '11px', color: rank.accent, fontStyle: 'italic', opacity: 0.75 }}>
            Max rank reached
          </div>
        )}
      </div>

      {/* Overlay toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', padding: '4px 2px 0' }}>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Points overlay</span>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{
            position: 'relative',
            width: '38px',
            height: '22px',
            borderRadius: '999px',
            background: showPointsOverlay ? '#22c55e' : '#d1d5db',
            transition: 'background 120ms ease',
          }}>
            <input
              type="checkbox"
              checked={showPointsOverlay}
              onChange={handlePointsOverlayToggle}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                margin: 0,
              }}
            />
            <span style={{
              position: 'absolute',
              top: '3px',
              left: showPointsOverlay ? '19px' : '3px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
              transition: 'left 120ms ease',
            }} />
          </span>
        </label>
      </div>

      {/* Immersion level */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Immersion level</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{pct}</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.75}
          step={0.25}
          value={density}
          onChange={handleDensityChange}
          style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          {Object.entries(DENSITY_LABELS).map(([val, label]) => (
            <span key={val} style={{ fontSize: '11px', color: '#d1d5db' }}>{label}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats !== null && (
        <div style={{
          display: 'flex',
          gap: '8px',
          borderTop: '1px solid #f3f4f6',
          paddingTop: '14px',
        }}>
          <div style={statBoxStyle}>
            <span style={statNumStyle}>{stats.translated}</span>
            <span style={statLabelStyle}>Translated</span>
          </div>
          <div style={statBoxStyle}>
            <span style={statNumStyle}>{stats.total}</span>
            <span style={statLabelStyle}>Total blocks</span>
          </div>
        </div>
      )}
    </div>
  )
}

const statBoxStyle: React.CSSProperties = {
  flex: 1,
  background: '#f9fafb',
  borderRadius: '8px',
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
}

const statNumStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#111827',
  lineHeight: 1,
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#9ca3af',
}
