const EXCLUDED_ANCESTORS = new Set(['NAV', 'FOOTER', 'SCRIPT', 'CODE', 'FORM', 'BUTTON'])

function isExcluded(el: Element): boolean {
  let node = el.parentElement
  while (node) {
    if (EXCLUDED_ANCESTORS.has(node.tagName)) return true
    node = node.parentElement
  }
  return false
}

interface DOMSentence {
  html: string // innerHTML of this sentence — sent to DeepL, preserves inline elements
  text: string // plain text — used for scoring only
}

// Splits a paragraph into sentences while preserving inline HTML.
// Only DIRECT text-node children of `p` are split at sentence boundaries;
// inline element children (links, em, cite, sup, etc.) are treated as atomic
// and assigned to whichever sentence they fall within.
function extractSentencesFromDOM(p: Element): DOMSentence[] {
  const sentences: DOMSentence[] = []
  const buf: Node[] = []

  function flush() {
    if (buf.length === 0) return
    const tmp = document.createElement('div')
    for (const n of buf) tmp.appendChild(n)
    const text = tmp.textContent?.trim() ?? ''
    if (text.length > 0) sentences.push({ html: tmp.innerHTML, text })
    buf.length = 0
  }

  for (const child of Array.from(p.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const raw = child.textContent ?? ''
      const re = /[.!?…](?=\s|$)/g
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(raw)) !== null) {
        const segEnd = m.index + 1
        const seg = raw.slice(last, segEnd)
        if (seg) buf.push(document.createTextNode(seg))
        flush()
        last = segEnd
        // consume whitespace between sentences
        while (last < raw.length && /\s/.test(raw[last])) last++
      }
      const tail = raw.slice(last)
      if (tail) buf.push(document.createTextNode(tail))
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      buf.push(child.cloneNode(true))
    }
  }

  flush()
  return sentences
}

interface Sentence {
  html: string
  text: string
  parent: Element
}

interface ParentEntry {
  html: string
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
    const domSentences = extractSentencesFromDOM(p)
    if (domSentences.length === 0) continue
    const entries: ParentEntry[] = []
    for (const { html, text } of domSentences) {
      entries.push({ html, text, globalIdx: sentences.length })
      sentences.push({ html, text, parent: p })
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

  // Send selected sentence HTML to the background in document order.
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

  // Rebuild each affected paragraph sentence by sentence.
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
        fragment.appendChild(span)
      } else {
        // Re-insert original HTML structure for untranslated sentences.
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
