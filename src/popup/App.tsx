import { useEffect, useState } from 'react'

function densityLabel(d: number): string {
  if (d === 0) return 'Off'
  return `${d * 100}%`
}

export default function App() {
  const [density, setDensity] = useState(0)

  useEffect(() => {
    chrome.storage.sync.get('density', ({ density = 0 }) => {
      setDensity(density as number)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseFloat(e.target.value)
    setDensity(value)
    chrome.storage.sync.set({ density: value })
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'SET_DENSITY', density: value }).catch(() => {
          // Content script not available on this page (e.g. chrome:// URLs)
        })
      }
    })
  }

  return (
    <div style={{ padding: '16px', width: '240px' }}>
      <h1 style={{ margin: '0 0 16px', fontSize: '18px' }}>Langblock</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Density</span>
        <span style={{ fontSize: '13px', color: '#6366f1' }}>{densityLabel(density)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={0.75}
        step={0.25}
        value={density}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
    </div>
  )
}
