import { POINTS_THRESHOLD } from '../shared/points'
import type { ReviewQueue, UpdateReviewResponse } from '../shared/review'
import { coverageAdjustedPct, requestAwardPoints, requestScore } from './quiz'

const REVIEW_OVERLAY_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 2147483646;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50vw;
    min-width: 360px;
    max-width: 620px;
    max-height: 70vh;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid #f1f5f9;
    gap: 10px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .chip-progress {
    background: #eef2ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
  }
  .chip-lang {
    background: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
    text-transform: uppercase;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    font-size: 20px;
    line-height: 1;
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .close-btn:hover { background: #f3f4f6; color: #374151; }

  .body {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 4px 0 0;
  }

  .sentence-box {
    margin: 16px 18px;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 8px;
    padding: 14px 16px;
    font-size: 15px;
    color: #1d4ed8;
    line-height: 1.5;
  }

  textarea {
    display: block;
    width: calc(100% - 36px);
    margin: 0 18px 14px;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    resize: vertical;
    min-height: 88px;
    outline: none;
    font-family: inherit;
  }
  textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    border-top: 1px solid #f1f5f9;
    flex-shrink: 0;
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

  .primary-btn {
    background: #5479e9;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .primary-btn:hover { background: #1E4ED8; }
  .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .result-box {
    margin: 16px 18px;
    border-radius: 10px;
    overflow: hidden;
    font-size: 14px;
  }
  .result-box.green { background: rgba(22, 163, 74, 0.08); color: #166534; }
  .result-box.amber { background: rgba(217, 119, 6, 0.08); color: #92400e; }
  .result-box.red   { background: rgba(220, 38, 38, 0.08); color: #991b1b; }

  .result-score {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 14px 16px 10px;
  }
  .result-pct { font-size: 30px; font-weight: 700; line-height: 1; }
  .result-label { font-size: 14px; font-weight: 500; }

  .result-divider {
    height: 1px;
    margin: 0 16px;
    opacity: 0.25;
    background: currentColor;
  }

  .result-points {
    display: inline-flex;
    align-items: center;
    margin: 10px 16px 0;
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid currentColor;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .mastery-pill {
    display: inline-flex;
    align-items: center;
    margin: 10px 0 0 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(22, 163, 74, 0.15);
    border: 1px solid rgba(22, 163, 74, 0.35);
    color: #166534;
    font-size: 12px;
    font-weight: 600;
  }

  .result-row {
    display: flex;
    gap: 10px;
    padding: 8px 16px;
  }
  .result-row + .result-row { border-top: 1px solid rgba(0, 0, 0, 0.06); }
  .result-row-label {
    width: 60px;
    flex-shrink: 0;
    font-weight: 600;
    opacity: 0.65;
    padding-top: 1px;
  }
  .result-row-text { line-height: 1.5; }

  .summary {
    padding: 28px 18px;
    text-align: center;
  }
  .summary-title {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 8px;
  }
  .summary-stats {
    font-size: 14px;
    color: #4b5563;
    line-height: 1.6;
  }
  .summary-empty {
    font-size: 14px;
    color: #6b7280;
  }
`

export let reviewOverlayHost: HTMLElement | null = null
let reviewOverlayKeydown: ((e: KeyboardEvent) => void) | null = null

export function closeReviewOverlay(): void {
  if (reviewOverlayKeydown) {
    document.removeEventListener('keydown', reviewOverlayKeydown, true)
    reviewOverlayKeydown = null
  }
  reviewOverlayHost?.remove()
  reviewOverlayHost = null
}

export async function showReviewOverlay(): Promise<void> {
  closeReviewOverlay()

  const stored = await chrome.storage.local.get(['reviewQueue'])
  const initialQueue = ((stored.reviewQueue as ReviewQueue | undefined) ?? [])
    .slice()
    .sort((a, b) => a.addedAt - b.addedAt)

  const host = document.createElement('div')
  host.style.cssText = 'position: fixed; inset: 0; z-index: 2147483646;'
  document.body.appendChild(host)
  reviewOverlayHost = host

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = REVIEW_OVERLAY_STYLES
  shadow.appendChild(style)

  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  backdrop.addEventListener('click', () => closeReviewOverlay())
  shadow.appendChild(backdrop)

  const modal = document.createElement('div')
  modal.className = 'modal'
  modal.addEventListener('click', (e) => e.stopPropagation())
  shadow.appendChild(modal)

  reviewOverlayKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeReviewOverlay()
  }
  document.addEventListener('keydown', reviewOverlayKeydown, true)

  const header = document.createElement('div')
  header.className = 'header'
  const headerLeft = document.createElement('div')
  headerLeft.className = 'header-left'
  const title = document.createElement('span')
  title.className = 'header-title'
  title.textContent = 'Review'
  const progressChip = document.createElement('span')
  progressChip.className = 'chip chip-progress'
  const langChip = document.createElement('span')
  langChip.className = 'chip chip-lang'
  const closeBtn = document.createElement('button')
  closeBtn.className = 'close-btn'
  closeBtn.textContent = '×'
  closeBtn.addEventListener('click', () => closeReviewOverlay())
  headerLeft.append(title, progressChip, langChip)
  header.append(headerLeft, closeBtn)
  modal.appendChild(header)

  const body = document.createElement('div')
  body.className = 'body'
  modal.appendChild(body)

  if (initialQueue.length === 0) {
    progressChip.style.display = 'none'
    langChip.style.display = 'none'
    const summary = document.createElement('div')
    summary.className = 'summary'
    summary.innerHTML = `
      <div class="summary-title">Nothing to review</div>
      <div class="summary-empty">Fail a sentence below 75% to queue it for review.</div>
    `
    body.appendChild(summary)
    return
  }

  let cursor = 0
  let masteredCount = 0
  let failedCount = 0

  function renderIdle() {
    body.innerHTML = ''
    const item = initialQueue[cursor]
    progressChip.textContent = `${cursor + 1} / ${initialQueue.length}`
    langChip.textContent = item.targetLang

    const sentenceBox = document.createElement('div')
    sentenceBox.className = 'sentence-box'
    sentenceBox.textContent = item.translatedText

    const ta = document.createElement('textarea')
    ta.placeholder = 'Type your English translation here…'

    const footer = document.createElement('div')
    footer.className = 'footer'

    const showAnswerBtn = document.createElement('button')
    showAnswerBtn.className = 'link-btn'
    showAnswerBtn.textContent = 'Show answer'
    showAnswerBtn.addEventListener('click', () => renderResult(null, null, 0, 0, false))

    const checkBtn = document.createElement('button')
    checkBtn.className = 'primary-btn'
    checkBtn.textContent = 'Check'

    async function submitAttempt() {
      const attempt = ta.value.trim()
      if (!attempt) return
      checkBtn.disabled = true
      checkBtn.textContent = 'Checking…'
      const rawPct = await requestScore(attempt, item.originalText)
      const pct = coverageAdjustedPct(rawPct, attempt, item.originalText)

      const pointsResult = pct >= POINTS_THRESHOLD
        ? await requestAwardPoints(item.originalText, pct)
        : { pointsTotal: 0, showPointsOverlay: false, streakDays: 0, lastActiveDate: '', awardedPoints: 0 }

      chrome.runtime
        .sendMessage({ type: 'RECORD_ACTIVITY', pointsEarned: pointsResult.awardedPoints })
        .catch(() => {})

      const updateResult: UpdateReviewResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'UPDATE_REVIEW',
            originalText: item.originalText,
            translatedText: item.translatedText,
            targetLang: item.targetLang,
            score: pct,
            sourceUrl: item.sourceUrl,
          },
          (response: UpdateReviewResponse | null) => {
            resolve(response ?? { queue: [], removed: false })
          },
        )
      })

      if (updateResult.removed) masteredCount++
      else if (pct < 75) failedCount++

      renderResult(attempt, pct, pointsResult.awardedPoints, item.originalText.length, updateResult.removed)
    }

    ta.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submitAttempt()
      }
    })
    checkBtn.addEventListener('click', submitAttempt)

    footer.append(showAnswerBtn, checkBtn)
    body.append(sentenceBox, ta)

    const existingFooter = modal.querySelector(':scope > .footer')
    if (existingFooter) existingFooter.remove()
    modal.appendChild(footer)

    ta.focus()
  }

  function renderResult(
    attempt: string | null,
    pct: number | null,
    awardedPoints: number,
    maxPoints: number,
    mastered: boolean,
  ) {
    body.innerHTML = ''
    const item = initialQueue[cursor]
    const hasScore = attempt !== null && pct !== null
    const colorCls = !hasScore ? '' : pct! >= POINTS_THRESHOLD ? 'green' : pct! >= 50 ? 'amber' : 'red'
    const label = !hasScore ? '' : pct! >= POINTS_THRESHOLD ? 'Great job!' : pct! >= 50 ? 'Close!' : 'Keep practicing'

    const resultBox = document.createElement('div')
    resultBox.className = `result-box ${colorCls || 'amber'}`
    if (!hasScore) {
      resultBox.style.background = '#f8fafc'
      resultBox.style.color = '#374151'
    }

    if (hasScore) {
      const scoreRow = document.createElement('div')
      scoreRow.className = 'result-score'
      scoreRow.innerHTML = `<span class="result-pct">${pct}%</span><span class="result-label">${label}</span>`
      const divider = document.createElement('div')
      divider.className = 'result-divider'
      resultBox.appendChild(scoreRow)
      resultBox.appendChild(divider)
    }

    if (awardedPoints > 0 || mastered) {
      const row = document.createElement('div')
      row.style.cssText = 'display: flex; align-items: center; flex-wrap: wrap; padding-left: 8px;'
      if (awardedPoints > 0) {
        const pill = document.createElement('div')
        pill.className = 'result-points'
        pill.textContent = `+${awardedPoints}/${maxPoints} points`
        row.appendChild(pill)
      }
      if (mastered) {
        const masteryPill = document.createElement('div')
        masteryPill.className = 'mastery-pill'
        masteryPill.textContent = '✓ Mastered — removed from queue'
        row.appendChild(masteryPill)
      }
      resultBox.appendChild(row)
    }

    if (hasScore) {
      const yoursRow = document.createElement('div')
      yoursRow.className = 'result-row'
      yoursRow.innerHTML = `<span class="result-row-label">Yours:</span><span class="result-row-text"></span>`
      ;(yoursRow.lastElementChild as HTMLElement).textContent = attempt!
      resultBox.appendChild(yoursRow)
    }

    const originalRow = document.createElement('div')
    originalRow.className = 'result-row'
    originalRow.innerHTML = `<span class="result-row-label">Original:</span><span class="result-row-text"></span>`
    ;(originalRow.lastElementChild as HTMLElement).textContent = item.originalText
    resultBox.appendChild(originalRow)

    body.appendChild(resultBox)

    const existingFooter = modal.querySelector(':scope > .footer')
    if (existingFooter) existingFooter.remove()

    const footer = document.createElement('div')
    footer.className = 'footer'

    const tryAgainBtn = document.createElement('button')
    tryAgainBtn.className = 'link-btn'
    tryAgainBtn.textContent = 'Try again'
    tryAgainBtn.addEventListener('click', renderIdle)

    const nextBtn = document.createElement('button')
    nextBtn.className = 'primary-btn'
    const isLast = cursor === initialQueue.length - 1
    nextBtn.textContent = isLast ? 'Finish' : 'Next'
    nextBtn.addEventListener('click', () => {
      if (isLast) {
        renderSummary()
      } else {
        cursor++
        renderIdle()
      }
    })

    footer.append(tryAgainBtn, nextBtn)
    modal.appendChild(footer)
  }

  function renderSummary() {
    body.innerHTML = ''
    progressChip.style.display = 'none'
    langChip.style.display = 'none'

    const reviewed = cursor + 1

    const summary = document.createElement('div')
    summary.className = 'summary'
    summary.innerHTML = `
      <div class="summary-title">Session complete</div>
      <div class="summary-stats">
        Reviewed ${reviewed} · ${masteredCount} mastered · ${failedCount} queued again
      </div>
    `
    body.appendChild(summary)

    const existingFooter = modal.querySelector(':scope > .footer')
    if (existingFooter) existingFooter.remove()

    const footer = document.createElement('div')
    footer.className = 'footer'
    footer.style.justifyContent = 'flex-end'

    const doneBtn = document.createElement('button')
    doneBtn.className = 'primary-btn'
    doneBtn.textContent = 'Done'
    doneBtn.addEventListener('click', () => closeReviewOverlay())

    footer.appendChild(doneBtn)
    modal.appendChild(footer)
  }

  renderIdle()
}
