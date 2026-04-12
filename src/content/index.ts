import { buildSentences, scoreSentence, type Sentence, type ParentEntry } from './sentences'
import { showOverlay, closeOverlay, overlayHost } from './overlay'
import { DEFAULT_POINTS_STATE, normalizePointsState, type PointsState } from '../shared/points'

const originalHTML = new Map<Element, string>()
let pointsBadgeHost: HTMLElement | null = null
let pointsBadgeText: HTMLElement | null = null
let pointsState = DEFAULT_POINTS_STATE
let pointsBadgeAnimationFrame: number | null = null

function stopPointsBadgeAnimation(): void {
  if (pointsBadgeAnimationFrame !== null) {
    cancelAnimationFrame(pointsBadgeAnimationFrame)
    pointsBadgeAnimationFrame = null
  }
}

function setPointsBadgeText(pointsTotal: number): void {
  if (pointsBadgeText) {
    pointsBadgeText.textContent = `${pointsTotal} pts`
  }
}

function animatePointsBadge(from: number, to: number): void {
  stopPointsBadgeAnimation()

  const durationMs = 700
  const start = performance.now()

  function frame(now: number) {
    const progress = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - progress) * (1 - progress)
    const current = Math.round(from + (to - from) * eased)
    setPointsBadgeText(current)

    if (progress < 1) {
      pointsBadgeAnimationFrame = requestAnimationFrame(frame)
    } else {
      pointsBadgeAnimationFrame = null
      setPointsBadgeText(to)
    }
  }

  pointsBadgeAnimationFrame = requestAnimationFrame(frame)
}

function ensurePointsBadge(): HTMLElement {
  if (pointsBadgeHost && pointsBadgeText) return pointsBadgeHost

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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 76px;
      padding: 9px 14px;
      border-radius: 14px;
      background: #dcfce7;
      border: 1px solid #22c55e;
      box-shadow: 0 10px 24px rgba(22, 101, 52, 0.14);
      color: #166534;
      font: 700 14px/1 system-ui, sans-serif;
      letter-spacing: 0.01em;
    }
  `
  const badge = document.createElement('div')
  badge.className = 'badge'
  shadow.append(style, badge)

  document.documentElement.appendChild(host)
  pointsBadgeHost = host
  pointsBadgeText = badge
  return host
}

function renderPointsBadge(pointsTotal: number, showPointsOverlay: boolean): void {
  const previousState = pointsState
  pointsState = { pointsTotal, showPointsOverlay }

  if (!showPointsOverlay) {
    stopPointsBadgeAnimation()
    pointsBadgeHost?.remove()
    pointsBadgeHost = null
    pointsBadgeText = null
    return
  }

  ensurePointsBadge()
  if (pointsTotal > previousState.pointsTotal && previousState.showPointsOverlay) {
    animatePointsBadge(previousState.pointsTotal, pointsTotal)
  } else {
    stopPointsBadgeAnimation()
    setPointsBadgeText(pointsTotal)
  }
}

function loadPointsBadge(): void {
  chrome.runtime.sendMessage({ type: 'GET_POINTS_STATE' })
    .then((state) => {
      const nextState = normalizePointsState(state as Partial<PointsState>)
      renderPointsBadge(nextState.pointsTotal, nextState.showPointsOverlay)
    })
    .catch(() => renderPointsBadge(DEFAULT_POINTS_STATE.pointsTotal, DEFAULT_POINTS_STATE.showPointsOverlay))
}

async function applyDensity(
  sentences: Sentence[],
  sentencesByParent: Map<Element, ParentEntry[]>,
  density: number,
  lang: string,
): Promise<void> {
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
        span.addEventListener('click', () => showOverlay(span, html, String(globalIdx)))
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
  if (!changes.pointsTotal && !changes.showPointsOverlay) return

  const nextState = normalizePointsState({
    pointsTotal: (changes.pointsTotal?.newValue as number | undefined) ?? pointsState.pointsTotal,
    showPointsOverlay: (changes.showPointsOverlay?.newValue as boolean | undefined) ?? pointsState.showPointsOverlay,
  })

  renderPointsBadge(nextState.pointsTotal, nextState.showPointsOverlay)
})

function getStats() {
  return {
    translated: document.querySelectorAll('.langblock-translated').length,
    total: sentences.length,
  }
}

chrome.runtime.onMessage.addListener((msg: { type: string; density: number; lang: string }, _sender, sendResponse) => {
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
