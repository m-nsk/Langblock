import { buildSentences, scoreSentence, type Sentence, type ParentEntry } from './sentences'
import { showOverlay, closeOverlay, overlayHost } from './overlay'

const originalHTML = new Map<Element, string>()

async function applyDensity(
  sentences: Sentence[],
  sentencesByParent: Map<Element, ParentEntry[]>,
  density: number,
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
      targetLang: 'FR',
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
        span.addEventListener('click', () => showOverlay(span, html))
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
      border-radius: 4px;
      padding: 2px 5px;
      cursor: pointer;
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

chrome.storage.sync.get('density', ({ density = 0 }) => {
  void applyDensity(sentences, sentencesByParent, density as number)
})

function getStats() {
  return {
    translated: document.querySelectorAll('.langblock-translated').length,
    total: sentences.length,
  }
}

chrome.runtime.onMessage.addListener((msg: { type: string; density: number }, _sender, sendResponse) => {
  if (msg.type === 'SET_DENSITY') {
    // Respond immediately with an estimate so the message channel doesn't
    // time out during the async DeepL call.
    const estimated = msg.density === 0 ? 0 : Math.ceil(sentences.length * msg.density)
    sendResponse({ translated: estimated, total: sentences.length })
    void applyDensity(sentences, sentencesByParent, msg.density)
  }
  if (msg.type === 'GET_STATS') {
    sendResponse(getStats())
  }
})
