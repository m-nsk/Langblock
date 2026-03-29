const EXCLUDED_ANCESTORS = new Set(['NAV', 'FOOTER', 'SCRIPT', 'CODE', 'FORM', 'BUTTON'])

function isExcluded(el: Element): boolean {
  let node = el.parentElement
  while (node) {
    if (EXCLUDED_ANCESTORS.has(node.tagName)) return true
    node = node.parentElement
  }
  return false
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

interface Sentence {
  text: string
  parent: Element
}

// Each entry carries the global sentence index so applyDensity can look up
// which sentences within a paragraph were selected for translation.
interface ParentEntry {
  text: string
  globalIdx: number
}

function buildSentences(): {
  sentences: Sentence[]
  sentencesByParent: Map<Element, ParentEntry[]>
} {
  const sentences: Sentence[] = []
  const sentencesByParent = new Map<Element, ParentEntry[]>()

  for (const p of Array.from(document.querySelectorAll('p'))) {
    if (isExcluded(p)) continue
    const text = p.textContent?.trim() ?? ''
    if (!text) continue
    const parts = splitSentences(text)
    if (parts.length === 0) continue
    const entries: ParentEntry[] = []
    for (const sentText of parts) {
      entries.push({ text: sentText, globalIdx: sentences.length })
      sentences.push({ text: sentText, parent: p })
    }
    sentencesByParent.set(p, entries)
  }

  return { sentences, sentencesByParent }
}

function scoreSentence(s: Sentence, pageHeight: number): number {
  let score = Math.max(0, 200 - s.text.length)
  const absTop = s.parent.getBoundingClientRect().top + window.scrollY
  if (pageHeight > 0 && absTop / pageHeight < 0.2) score -= 15
  return score
}

// Stores original innerHTML per paragraph so restoration is exact.
const originalHTML = new Map<Element, string>()

async function applyDensity(
  sentences: Sentence[],
  sentencesByParent: Map<Element, ParentEntry[]>,
  density: number,
): Promise<void> {
  for (const [el, html] of originalHTML) {
    el.innerHTML = html
  }
  originalHTML.clear()

  if (density === 0) return

  const pageHeight = document.documentElement.scrollHeight
  const scored = sentences
    .map((s, idx) => ({ s, idx, score: scoreSentence(s, pageHeight) }))
    .sort((a, b) => b.score - a.score)

  // Greedy selection in score order: skip any candidate whose immediate
  // neighbour (in document order) is already selected.
  const selectedIndices = new Set<number>()
  const count = Math.ceil(sentences.length * density)
  for (const { idx } of scored) {
    if (selectedIndices.size >= count) break
    if (!selectedIndices.has(idx - 1) && !selectedIndices.has(idx + 1)) {
      selectedIndices.add(idx)
    }
  }

  // Send only the selected sentence texts for translation (in document order).
  const selectedList = [...selectedIndices].sort((a, b) => a - b)

  let translated: string[]
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_BLOCKS',
      texts: selectedList.map((idx) => sentences[idx].text),
      targetLang: 'FR',
    })
    if (!Array.isArray(result)) throw new Error('unexpected response')
    translated = result as string[]
  } catch (err) {
    console.error('[Langblock] translation failed', err)
    return
  }

  // Map global sentence index → translated text.
  const translationMap = new Map<number, string>()
  selectedList.forEach((idx, i) => translationMap.set(idx, translated[i]))

  // Rebuild each affected paragraph as individual sentence spans + text nodes.
  const affectedParents = new Set(selectedList.map((idx) => sentences[idx].parent))
  for (const parentEl of affectedParents) {
    const entries = sentencesByParent.get(parentEl)!
    originalHTML.set(parentEl, parentEl.innerHTML)
    const fragment = document.createDocumentFragment()
    entries.forEach(({ text, globalIdx }, i) => {
      const translatedText = translationMap.get(globalIdx)
      if (translatedText !== undefined) {
        const span = document.createElement('span')
        span.className = 'langblock-translated'
        span.dataset.langblockOriginal = text
        span.textContent = translatedText
        fragment.appendChild(span)
      } else {
        fragment.appendChild(document.createTextNode(text))
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
      background: rgba(59, 130, 246, 0.08);
      border-left: 3px solid rgba(59, 130, 246, 0.3);
      padding: 2px 6px;
      cursor: pointer;
    }
    .langblock-translated:hover {
      background: rgba(59, 130, 246, 0.15);
    }
  `
  document.head.appendChild(style)
}

const { sentences, sentencesByParent } = buildSentences()

injectStyles()

chrome.storage.sync.get('density', ({ density = 0 }) => {
  void applyDensity(sentences, sentencesByParent, density as number)
})

chrome.runtime.onMessage.addListener((msg: { type: string; density: number }) => {
  if (msg.type === 'SET_DENSITY') {
    void applyDensity(sentences, sentencesByParent, msg.density)
  }
})
