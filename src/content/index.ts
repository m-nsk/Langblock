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
  indexInParent: number
}

function buildSentences(): {
  sentences: Sentence[]
  sentencesByParent: Map<Element, string[]>
} {
  const sentences: Sentence[] = []
  const sentencesByParent = new Map<Element, string[]>()

  for (const p of Array.from(document.querySelectorAll('p'))) {
    if (isExcluded(p)) continue
    const text = p.textContent?.trim() ?? ''
    if (!text) continue
    const parts = splitSentences(text)
    if (parts.length === 0) continue
    sentencesByParent.set(p, parts)
    for (let i = 0; i < parts.length; i++) {
      sentences.push({ text: parts[i], parent: p, indexInParent: i })
    }
  }

  return { sentences, sentencesByParent }
}

function scoreSentence(s: Sentence, pageHeight: number): number {
  let score = Math.max(0, 200 - s.text.length)
  const absTop = s.parent.getBoundingClientRect().top + window.scrollY
  if (pageHeight > 0 && absTop / pageHeight < 0.2) score -= 15
  return score
}

// Stores original innerHTML per paragraph so applyDensity is idempotent.
const originalHTML = new Map<Element, string>()

function applyDensity(
  sentences: Sentence[],
  sentencesByParent: Map<Element, string[]>,
  density: number,
): void {
  for (const [el, html] of originalHTML) {
    el.innerHTML = html
  }
  originalHTML.clear()

  if (density === 0) return

  const pageHeight = document.documentElement.scrollHeight
  const scored = sentences
    .map((s, idx) => ({ s, idx, score: scoreSentence(s, pageHeight) }))
    .sort((a, b) => b.score - a.score)

  // Greedy selection in score order. Skip any candidate whose immediate
  // neighbour (in document order) is already selected — ensures at least
  // one untranslated sentence between every pair of translated ones.
  const selectedIndices = new Set<number>()
  const count = Math.ceil(sentences.length * density)
  for (const { idx } of scored) {
    if (selectedIndices.size >= count) break
    if (!selectedIndices.has(idx - 1) && !selectedIndices.has(idx + 1)) {
      selectedIndices.add(idx)
    }
  }

  // Group selected sentence positions by parent paragraph.
  const selectedByParent = new Map<Element, Set<number>>()
  for (const idx of selectedIndices) {
    const { parent, indexInParent } = sentences[idx]
    if (!selectedByParent.has(parent)) selectedByParent.set(parent, new Set())
    selectedByParent.get(parent)!.add(indexInParent)
  }

  // Rebuild each affected paragraph as a mix of text nodes and translated spans.
  for (const [parentEl, selectedSet] of selectedByParent) {
    const parts = sentencesByParent.get(parentEl)!
    originalHTML.set(parentEl, parentEl.innerHTML)
    const fragment = document.createDocumentFragment()
    parts.forEach((sentText, i) => {
      if (selectedSet.has(i)) {
        const span = document.createElement('span')
        span.className = 'langblock-translated'
        span.textContent = `[FR] ${sentText}`
        fragment.appendChild(span)
      } else {
        fragment.appendChild(document.createTextNode(sentText))
      }
      if (i < parts.length - 1) fragment.appendChild(document.createTextNode(' '))
    })
    parentEl.replaceChildren(fragment)
  }
}

function injectStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    .langblock-translated {
      background: rgba(99, 102, 241, 0.12);
      border-left: 3px solid #6366f1;
      padding: 1px 0 1px 6px;
      border-radius: 2px;
      color: #4338ca;
      font-style: italic;
    }
  `
  document.head.appendChild(style)
}

const { sentences, sentencesByParent } = buildSentences()

injectStyles()

chrome.storage.sync.get('density', ({ density = 0 }) => {
  applyDensity(sentences, sentencesByParent, density as number)
})

chrome.runtime.onMessage.addListener((msg: { type: string; density: number }) => {
  if (msg.type === 'SET_DENSITY') {
    applyDensity(sentences, sentencesByParent, msg.density)
  }
})
