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
  html: string // innerHTML — sent to DeepL, preserves inline elements
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
    // Skip citations like [20], [note 3], bare numbers, or any fragment
    // under 15 chars with no real word content — these are never worth translating.
    const hasWord = /[a-zA-Z]{3,}/.test(text)
    if (text.length >= 15 || hasWord) sentences.push({ html: tmp.innerHTML, text })
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

export interface Sentence {
  html: string
  text: string
  parent: Element
}

export interface ParentEntry {
  html: string
  text: string
  globalIdx: number
}

export function buildSentences(): {
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

export function scoreSentence(s: Sentence, pageHeight: number): number {
  let score = Math.max(0, 200 - s.text.length)
  const absTop = s.parent.getBoundingClientRect().top + window.scrollY
  if (pageHeight > 0 && absTop / pageHeight < 0.2) score -= 15
  return score
}
