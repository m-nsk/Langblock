import { buildSentences, scoreSentence, type Sentence, type ParentEntry } from './sentences'
import { showOverlay, closeOverlay, overlayHost } from './overlay'
import { showReviewOverlay } from './reviewOverlay'
import { DEFAULT_POINTS_STATE, getRank, normalizePointsState, type PointsState, type Rank } from '../shared/points'
import { animateCount } from '../shared/animateCount'

const originalHTML = new Map<Element, string>()
let pointsBadgeHost: HTMLElement | null = null
let pointsBadgeText: HTMLElement | null = null
let pointsBadgeRankLabel: HTMLElement | null = null
let pointsBadgeStreakEl: HTMLElement | null = null
let pointsBadgeBarFill: HTMLElement | null = null
let pointsBadgeBadgeEl: HTMLElement | null = null
let pointsState = DEFAULT_POINTS_STATE
let pointsInitialized = false
let cancelPointsBadgeAnim: (() => void) | null = null

function stopPointsBadgeAnimation(): void {
  if (cancelPointsBadgeAnim) {
    cancelPointsBadgeAnim()
    cancelPointsBadgeAnim = null
  }
}

function setPointsBadgePoints(points: number): void {
  if (pointsBadgeText) {
    pointsBadgeText.textContent = `${points.toLocaleString()} pts`
  }
  if (pointsBadgeBarFill) {
    const { next, progress } = getRank(points)
    pointsBadgeBarFill.style.width = next ? `${Math.max(2, progress * 100)}%` : '100%'
  }
}

function animatePointsBadge(from: number, to: number): void {
  stopPointsBadgeAnimation()
  cancelPointsBadgeAnim = animateCount(from, to, 700, setPointsBadgePoints)
}

function ensurePointsBadge(): HTMLElement {
  if (pointsBadgeHost && pointsBadgeText && pointsBadgeBarFill) return pointsBadgeHost

  const host = document.createElement('div')
  host.style.cssText = `
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 2147483646;
    pointer-events: none;
  `

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    .badge {
      width: 160px;
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--rank-bg);
      border: 1px solid var(--rank-border);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
      font-family: system-ui, sans-serif;
      box-sizing: border-box;
    }
    .badge-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .badge-rank {
      font: 700 10px/1 system-ui, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--rank-accent);
    }
    .badge-streak {
      font: 600 11px/1 system-ui, sans-serif;
      color: var(--rank-accent);
      border: 1.5px solid var(--rank-border);
      border-radius: 5px;
      padding: 1px 5px;
      line-height: 1;
    }
    .badge-streak-empty {
      font: 500 11px/1 system-ui, sans-serif;
      color: #9ca3af;
      border: 1.5px solid #e5e7eb;
      border-radius: 5px;
      padding: 1px 5px;
      line-height: 1;
    }
    .badge-pts {
      font: 700 15px/1 system-ui, sans-serif;
      color: var(--rank-text);
      margin-bottom: 8px;
    }
    .badge-bar-track {
      height: 3px;
      border-radius: 999px;
      background: var(--rank-border);
      overflow: hidden;
    }
    .badge-bar-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--rank-accent);
      transition: width 400ms ease;
    }
  `

  const badge = document.createElement('div')
  badge.className = 'badge'

  const top = document.createElement('div')
  top.className = 'badge-top'

  const rankLabel = document.createElement('span')
  rankLabel.className = 'badge-rank'

  const streakEl = document.createElement('span')

  const pts = document.createElement('div')
  pts.className = 'badge-pts'

  const barTrack = document.createElement('div')
  barTrack.className = 'badge-bar-track'

  const barFill = document.createElement('div')
  barFill.className = 'badge-bar-fill'
  barFill.style.width = '2%'

  barTrack.appendChild(barFill)
  top.append(rankLabel, streakEl)
  badge.append(top, pts, barTrack)
  shadow.append(style, badge)

  document.documentElement.appendChild(host)
  pointsBadgeHost = host
  pointsBadgeText = pts
  pointsBadgeRankLabel = rankLabel
  pointsBadgeStreakEl = streakEl
  pointsBadgeBarFill = barFill
  pointsBadgeBadgeEl = badge
  return host
}

function updateBadgeMeta(state: PointsState): void {
  const { rank } = getRank(state.pointsTotal)

  if (pointsBadgeBadgeEl) {
    pointsBadgeBadgeEl.style.setProperty('--rank-bg', rank.bg)
    pointsBadgeBadgeEl.style.setProperty('--rank-border', rank.border)
    pointsBadgeBadgeEl.style.setProperty('--rank-accent', rank.accent)
    pointsBadgeBadgeEl.style.setProperty('--rank-text', rank.text)
  }

  if (pointsBadgeRankLabel) {
    pointsBadgeRankLabel.textContent = rank.name
  }

  if (pointsBadgeStreakEl) {
    if (state.streakDays > 0) {
      pointsBadgeStreakEl.className = 'badge-streak'
      pointsBadgeStreakEl.textContent = `🔥 ${state.streakDays}`
    } else {
      pointsBadgeStreakEl.className = 'badge-streak-empty'
      pointsBadgeStreakEl.textContent = '–'
    }
  }
}

function showRankUpSplash(rank: Rank): void {
  const host = document.createElement('div')
  host.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 2147483647;
    pointer-events: none;
  `

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    @keyframes rankup {
      0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.75); }
      12%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); }
      22%  { transform: translate(-50%, -50%) scale(1); }
      65%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.06); }
    }
    .splash {
      position: absolute;
      top: 0;
      left: 0;
      transform: translate(-50%, -50%) scale(0.75);
      background: ${rank.bg};
      border: 1.5px solid ${rank.border};
      border-radius: 20px;
      padding: 28px 52px;
      text-align: center;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.16), 0 0 0 4px ${rank.border};
      animation: rankup 2.6s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
      white-space: nowrap;
    }
    .label {
      font: 600 13px/1 system-ui, sans-serif;
      color: ${rank.accent};
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 12px;
      opacity: 0.75;
    }
    .rank-name {
      font: 800 34px/1 system-ui, sans-serif;
      color: ${rank.text};
      letter-spacing: 0.01em;
    }
  `

  const splash = document.createElement('div')
  splash.className = 'splash'

  const label = document.createElement('div')
  label.className = 'label'
  label.textContent = 'Rank up!'

  const rankName = document.createElement('div')
  rankName.className = 'rank-name'
  rankName.textContent = rank.name

  splash.append(label, rankName)
  shadow.append(style, splash)
  document.documentElement.appendChild(host)

  setTimeout(() => host.remove(), 2700)
}

function renderPointsBadge(state: PointsState): void {
  const previousState = pointsState
  const wasInitialized = pointsInitialized
  pointsState = state
  pointsInitialized = true

  if (wasInitialized && state.pointsTotal > previousState.pointsTotal) {
    const prevRank = getRank(previousState.pointsTotal).rank
    const newRank = getRank(state.pointsTotal).rank
    if (newRank.name !== prevRank.name) showRankUpSplash(newRank)
  }

  if (!state.showPointsOverlay) {
    stopPointsBadgeAnimation()
    pointsBadgeHost?.remove()
    pointsBadgeHost = null
    pointsBadgeText = null
    pointsBadgeRankLabel = null
    pointsBadgeStreakEl = null
    pointsBadgeBarFill = null
    pointsBadgeBadgeEl = null
    return
  }

  ensurePointsBadge()
  updateBadgeMeta(state)

  if (state.pointsTotal > previousState.pointsTotal && previousState.showPointsOverlay) {
    animatePointsBadge(previousState.pointsTotal, state.pointsTotal)
  } else {
    stopPointsBadgeAnimation()
    setPointsBadgePoints(state.pointsTotal)
  }
}

function loadPointsBadge(): void {
  chrome.runtime.sendMessage({ type: 'GET_POINTS_STATE' })
    .then((state) => {
      const nextState = normalizePointsState(state as Partial<PointsState>)
      renderPointsBadge(nextState)
    })
    .catch(() => renderPointsBadge(DEFAULT_POINTS_STATE))
}

let currentLang: string = 'FR'

async function applyDensity(
  sentences: Sentence[],
  sentencesByParent: Map<Element, ParentEntry[]>,
  density: number,
  lang: string,
): Promise<void> {
  currentLang = lang
  closeOverlay()
  for (const [el, html] of originalHTML) {
    el.innerHTML = html
  }
  originalHTML.clear()

  if (density === 0) return

  const pageHeight = document.documentElement.scrollHeight
  const scored = sentences
    .map((s, idx) => ({ s, idx, score: scoreSentence(s, pageHeight) }))
    .sort((a, b) => b.score - a.score)

  // At low density keep a gap of 1 between translated sentences so there's
  // always context around them. Above 50% relax the gap so the count target
  // is actually reachable (a gap of 1 caps selection at ~50%).
  const enforceGap = density <= 0.5
  const selectedIndices = new Set<number>()
  const count = Math.ceil(sentences.length * density)
  for (const { idx } of scored) {
    if (selectedIndices.size >= count) break
    if (!enforceGap || (!selectedIndices.has(idx - 1) && !selectedIndices.has(idx + 1))) {
      selectedIndices.add(idx)
    }
  }

  const selectedList = [...selectedIndices].sort((a, b) => a - b)

  let translated: string[]
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_BLOCKS',
      texts: selectedList.map((idx) => sentences[idx].html),
      targetLang: lang,
    })
    if (!Array.isArray(result)) throw new Error('unexpected response')
    translated = result as string[]
  } catch (err) {
    console.error('[Langblock] translation failed', err)
    return
  }

  const translationMap = new Map<number, string>()
  selectedList.forEach((idx, i) => translationMap.set(idx, translated[i]))

  const affectedParents = new Set(selectedList.map((idx) => sentences[idx].parent))
  for (const parentEl of affectedParents) {
    const entries = sentencesByParent.get(parentEl)!
    originalHTML.set(parentEl, parentEl.innerHTML)
    const fragment = document.createDocumentFragment()
    entries.forEach(({ html, globalIdx }, i) => {
      const translatedHtml = translationMap.get(globalIdx)
      if (translatedHtml !== undefined) {
        const span = document.createElement('span')
        span.className = 'langblock-translated'
        span.dataset.langblockOriginal = html
        span.innerHTML = translatedHtml
        span.addEventListener('click', () =>
          showOverlay(span, html, String(globalIdx), currentLang, location.href),
        )
        fragment.appendChild(span)
      } else {
        const tmpl = document.createElement('template')
        tmpl.innerHTML = html
        fragment.appendChild(tmpl.content)
      }
      if (i < entries.length - 1) fragment.appendChild(document.createTextNode(' '))
    })
    parentEl.replaceChildren(fragment)
  }
}

function injectStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    .langblock-translated {
      background: rgba(59, 130, 246, 0.15);
      color: #0f172a;
      border-radius: 4px;
      padding: 2px 5px;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(29, 78, 216, 0.45);
      -webkit-text-stroke: 0.35px #1d4ed8;
      paint-order: stroke fill;
    }
    .langblock-translated:hover {
      background: rgba(59, 130, 246, 0.2);
    }
  `
  document.head.appendChild(style)
}

document.addEventListener('click', (e) => {
  if (overlayHost && !overlayHost.contains(e.target as Node)) {
    closeOverlay()
  }
}, true)

const { sentences, sentencesByParent } = buildSentences()

injectStyles()
loadPointsBadge()

chrome.storage.sync.get(['density', 'lang'], ({ density = 0, lang = 'FR' }) => {
  void applyDensity(sentences, sentencesByParent, density as number, lang as string)
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return
  if (!changes.pointsTotal && !changes.showPointsOverlay && !changes.streakDays) return

  const nextState = normalizePointsState({
    pointsTotal: (changes.pointsTotal?.newValue as number | undefined) ?? pointsState.pointsTotal,
    showPointsOverlay: (changes.showPointsOverlay?.newValue as boolean | undefined) ?? pointsState.showPointsOverlay,
    streakDays: (changes.streakDays?.newValue as number | undefined) ?? pointsState.streakDays,
    lastActiveDate: pointsState.lastActiveDate,
  })

  renderPointsBadge(nextState)
})

function getStats() {
  return {
    translated: document.querySelectorAll('.langblock-translated').length,
    total: sentences.length,
  }
}

chrome.runtime.onMessage.addListener((msg: { type: string; density: number; lang: string }, _sender, sendResponse) => {
  if (msg.type === 'START_REVIEW') {
    void showReviewOverlay()
    sendResponse({ ok: true })
    return
  }
  if (msg.type === 'SET_DENSITY') {
    // Respond immediately with an estimate so the message channel doesn't
    // time out during the async DeepL call.
    const estimated = msg.density === 0 ? 0 : Math.ceil(sentences.length * msg.density)
    sendResponse({ translated: estimated, total: sentences.length })
    chrome.storage.sync.get('lang', ({ lang = 'FR' }) => {
      void applyDensity(sentences, sentencesByParent, msg.density, lang as string)
    })
  }
  if (msg.type === 'SET_LANG') {
    sendResponse(getStats())
    chrome.storage.sync.get('density', ({ density = 0 }) => {
      void applyDensity(sentences, sentencesByParent, density as number, msg.lang)
    })
  }
  if (msg.type === 'GET_STATS') {
    sendResponse(getStats())
  }
})
