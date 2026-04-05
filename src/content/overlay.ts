const OVERLAY_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }

  .card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #f1f5f9;
  }

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .close-btn:hover { background: #f3f4f6; color: #374151; }

  .sentence-box {
    margin: 12px 14px;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 14px;
    color: #1d4ed8;
    line-height: 1.5;
  }

  textarea {
    display: block;
    width: calc(100% - 28px);
    margin: 0 14px 12px;
    padding: 9px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    color: #111827;
    resize: vertical;
    min-height: 72px;
    outline: none;
    font-family: inherit;
  }
  textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-top: 1px solid #f1f5f9;
  }

  .show-answer-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: #6b7280;
    text-decoration: underline;
    padding: 0;
    font-family: inherit;
  }
  .show-answer-btn:hover { color: #374151; }

  .check-btn {
    background: #5479e9;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .check-btn:hover { background: #1E4ED8; }

  /* Result screen */
  .result-box {
    margin: 12px 14px;
    border-radius: 8px;
    overflow: hidden;
    font-size: 13px;
  }
  .result-box.green { background: rgba(22, 163, 74, 0.08); color: #166534; }
  .result-box.amber { background: rgba(217, 119, 6, 0.08); color: #92400e; }
  .result-box.red   { background: rgba(220, 38, 38, 0.08); color: #991b1b; }

  .result-score {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 12px 14px 10px;
  }
  .result-pct {
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
  }
  .result-label {
    font-size: 13px;
    font-weight: 500;
  }
  .result-divider {
    height: 1px;
    margin: 0 14px;
    opacity: 0.25;
    background: currentColor;
  }
  .result-row {
    display: flex;
    gap: 10px;
    padding: 8px 14px;
  }
  .result-row + .result-row {
    border-top: 1px solid rgba(0,0,0,0.06);
  }
  .result-row-label {
    width: 52px;
    flex-shrink: 0;
    font-weight: 600;
    opacity: 0.65;
    padding-top: 1px;
  }
  .result-row-text { line-height: 1.5; }

  /* Show-answer result (no score, neutral box) */
  .result-box.neutral { background: #f8fafc; color: #374151; }

  .result-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 14px;
    border-top: 1px solid #f1f5f9;
    margin-top: 4px;
  }
  .link-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: #6b7280;
    text-decoration: underline;
    padding: 0;
    font-family: inherit;
  }
  .link-btn:hover { color: #374151; }
`

function requestScore(textA: string, textB: string): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SCORE_SIMILARITY', textA, textB },
      (response: { score?: number; error?: string } | null) => {
        resolve(response?.score ?? 0)
      },
    )
  })
}

function launchConfetti(shadow: ShadowRoot): void {
  const canvas = document.createElement('canvas')
  const W = 480
  const H = 300
  canvas.width = W
  canvas.height = H
  canvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${W}px;
    height: ${H}px;
    pointer-events: none;
    z-index: 10;
  `
  shadow.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  const colors = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7']
  const particles = Array.from({ length: 80 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: H / 2,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * -10 - 4,
    size: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI * 2,
    drot: (Math.random() - 0.5) * 0.3,
    alpha: 1,
  }))

  let frame = 0
  function tick() {
    ctx.clearRect(0, 0, W, H)
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.35
      p.rot += p.drot
      if (frame > 40) p.alpha -= 0.02
      if (p.alpha <= 0) continue
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    frame++
    if (frame < 90) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

export let overlayHost: HTMLElement | null = null

export function closeOverlay(): void {
  overlayHost?.remove()
  overlayHost = null
}

export function revertSpan(span: HTMLElement): void {
  const original = span.dataset.langblockOriginal ?? ''
  const tmpl = document.createElement('template')
  tmpl.innerHTML = original
  span.replaceWith(tmpl.content)
  closeOverlay()
}

export function showOverlay(span: HTMLElement, originalHtml: string): void {
  closeOverlay()

  const translatedText = span.textContent ?? ''
  const originalText = (() => {
    const tmp = document.createElement('div')
    tmp.innerHTML = originalHtml
    return tmp.textContent ?? ''
  })()

  const rect = span.getBoundingClientRect()
  const host = document.createElement('div')
  host.style.cssText = `
    position: absolute;
    top: ${rect.bottom + window.scrollY + 6}px;
    left: ${Math.max(8, rect.left + window.scrollX)}px;
    width: 480px;
    z-index: 2147483647;
  `
  document.body.appendChild(host)
  overlayHost = host

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES
  const card = document.createElement('div')
  card.className = 'card'

  function makeHeader(title: string, onClose: () => void): HTMLElement {
    const header = document.createElement('div')
    header.className = 'header'
    const titleEl = document.createElement('span')
    titleEl.className = 'header-title'
    titleEl.textContent = title
    const closeBtn = document.createElement('button')
    closeBtn.className = 'close-btn'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', onClose)
    header.appendChild(titleEl)
    header.appendChild(closeBtn)
    return header
  }

  function renderIdle() {
    card.innerHTML = ''

    const sentenceBox = document.createElement('div')
    sentenceBox.className = 'sentence-box'
    sentenceBox.textContent = translatedText

    const ta = document.createElement('textarea')
    ta.placeholder = 'Type your English translation here…'

    const showAnswerBtn = document.createElement('button')
    showAnswerBtn.className = 'show-answer-btn'
    showAnswerBtn.textContent = 'Show answer'
    showAnswerBtn.addEventListener('click', () => renderResult(null))

    const checkBtn = document.createElement('button')
    checkBtn.className = 'check-btn'
    checkBtn.textContent = 'Check'

    async function submitAttempt() {
      const attempt = ta.value.trim()
      if (!attempt) return
      checkBtn.disabled = true
      checkBtn.textContent = 'Checking…'
      const pct = await requestScore(attempt, originalText)
      renderResult(attempt, pct)
    }

    ta.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submitAttempt()
      }
    })

    checkBtn.addEventListener('click', submitAttempt)

    const footer = document.createElement('div')
    footer.className = 'footer'
    footer.appendChild(showAnswerBtn)
    footer.appendChild(checkBtn)

    card.append(makeHeader('Translate back to English', closeOverlay), sentenceBox, ta, footer)
    ta.focus()
  }

  function renderResult(attempt: string | null, pct: number | null = null) {
    card.innerHTML = ''
    card.appendChild(makeHeader('Result', closeOverlay))

    const hasScore = attempt !== null && pct !== null
    const colorCls = !hasScore ? 'neutral' : pct! >= 80 ? 'green' : pct! >= 50 ? 'amber' : 'red'
    const label = !hasScore ? '' : pct! >= 80 ? 'Great job!' : pct! >= 50 ? 'Close!' : 'Keep practicing'

    const resultBox = document.createElement('div')
    resultBox.className = `result-box ${colorCls}`

    if (hasScore) {
      const scoreRow = document.createElement('div')
      scoreRow.className = 'result-score'
      scoreRow.innerHTML = `<span class="result-pct">${pct}%</span><span class="result-label">${label}</span>`
      const divider = document.createElement('div')
      divider.className = 'result-divider'
      resultBox.appendChild(scoreRow)
      resultBox.appendChild(divider)
      if (pct! >= 95) launchConfetti(shadow)
    }

    if (hasScore) {
      const yoursRow = document.createElement('div')
      yoursRow.className = 'result-row'
      yoursRow.innerHTML = `<span class="result-row-label">Yours:</span><span class="result-row-text">${attempt}</span>`
      resultBox.appendChild(yoursRow)
    }

    const originalRow = document.createElement('div')
    originalRow.className = 'result-row'
    originalRow.innerHTML = `<span class="result-row-label">Original:</span><span class="result-row-text">${originalText}</span>`
    resultBox.appendChild(originalRow)

    card.appendChild(resultBox)

    const tryAgainBtn = document.createElement('button')
    tryAgainBtn.className = 'link-btn'
    tryAgainBtn.textContent = 'Try again'
    tryAgainBtn.addEventListener('click', renderIdle)

    const revertBtn = document.createElement('button')
    revertBtn.className = 'link-btn'
    revertBtn.textContent = 'Revert to original'
    revertBtn.addEventListener('click', () => revertSpan(span))

    const resultFooter = document.createElement('div')
    resultFooter.className = 'result-footer'
    resultFooter.appendChild(tryAgainBtn)
    resultFooter.appendChild(revertBtn)
    card.appendChild(resultFooter)
  }

  renderIdle()
  shadow.appendChild(style)
  shadow.appendChild(card)
}
