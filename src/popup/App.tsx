import { useEffect, useState } from 'react'

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


export default function App() {
  const [density, setDensity] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    chrome.storage.sync.get('density', ({ density = 0 }) => {
      setDensity(density as number)
    })
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' })
          .then((res) => setStats(res as Stats))
          .catch(() => {})
      }
    })
  }, [])

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

  const pct = density === 0 ? 'Off' : `${Math.round(density * 100)}%`

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
            defaultValue="fr"
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
            <option value="fr">French</option>
          </select>
          <svg
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }}
            width="14" height="14" viewBox="0 0 16 16" fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
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
