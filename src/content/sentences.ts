const EXCLUDED_ANCESTORS = new Set([
  'NAV',
  'FOOTER',
  'SCRIPT',
  'CODE',
  'FORM',
  'BUTTON',
  'ASIDE',
  'HEADER',
  'FIGURE',
  'FIGCAPTION',
])

const EXCLUDED_ROLES = new Set(['navigation', 'banner', 'complementary', 'search', 'contentinfo'])

const EXCLUDED_ATTR_RE =
  /\b(nav|menu|sidebar|ad|advert|promo|cookie|banner|breadcrumb|pagination|share|social|related|comment)\b/i

function hasExcludedAttr(el: Element): boolean {
  const role = el.getAttribute('role')
  if (role && EXCLUDED_ROLES.has(role.toLowerCase())) return true
  const id = el.id
  if (id && EXCLUDED_ATTR_RE.test(id)) return true
  const cls = typeof el.className === 'string' ? el.className : ''
  if (cls && EXCLUDED_ATTR_RE.test(cls)) return true
  return false
}

function isExcluded(el: Element): boolean {
  let node: Element | null = el.parentElement
  while (node) {
    if (EXCLUDED_ANCESTORS.has(node.tagName)) return true
    // Don't apply attribute regex to <body>/<html>; site-wide layout classes
    // (e.g. WordPress "has-sidebar", "menu-open") would otherwise nuke every
    // candidate on the page.
    if (node.tagName !== 'BODY' && node.tagName !== 'HTML' && hasExcludedAttr(node)) return true
    node = node.parentElement
  }
  return false
}

interface DOMSentence {
  html: string // innerHTML — sent to DeepL, preserves inline elements
  text: string // plain text — used for scoring only
}

// Splits a block element into sentences while preserving inline HTML.
// Only DIRECT text-node children are split at sentence boundaries;
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
  absTop: number
}

export interface ParentEntry {
  html: string
  text: string
  globalIdx: number
}

const QUERY_SELECTOR = 'p, li, blockquote'
const CONTENT_ROOT_SELECTOR = 'main, article, [role="main"]'
const MIN_WORDS = 5
const MAX_LIST_ITEMS = 20

function collectCandidates(): Element[] {
  const roots = document.querySelectorAll(CONTENT_ROOT_SELECTOR)
  if (roots.length === 0) return Array.from(document.querySelectorAll(QUERY_SELECTOR))
  const out: Element[] = []
  const seen = new Set<Element>()
  for (const root of Array.from(roots)) {
    for (const el of Array.from(root.querySelectorAll(QUERY_SELECTOR))) {
      if (!seen.has(el)) {
        seen.add(el)
        out.push(el)
      }
    }
  }
  return out
}

function isListInNavLikeContainer(li: Element): boolean {
  let node: Element | null = li.parentElement
  while (node) {
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      let count = 0
      for (const child of Array.from(node.children)) {
        if (child.tagName === 'LI') count++
      }
      return count > MAX_LIST_ITEMS
    }
    node = node.parentElement
  }
  return false
}

function passesElementFilters(el: Element): boolean {
  if ((el as HTMLElement).offsetParent === null) return false
  const text = el.textContent ?? ''
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < MIN_WORDS) return false
  if (el.tagName === 'LI' && isListInNavLikeContainer(el)) return false
  return true
}

export function buildSentences(): {
  sentences: Sentence[]
  sentencesByParent: Map<Element, ParentEntry[]>
} {
  const sentences: Sentence[] = []
  const sentencesByParent = new Map<Element, ParentEntry[]>()

  for (const el of collectCandidates()) {
    if (isExcluded(el)) continue
    if (!passesElementFilters(el)) continue
    const domSentences = extractSentencesFromDOM(el)
    if (domSentences.length === 0) continue
    const absTop = el.getBoundingClientRect().top + window.scrollY
    const entries: ParentEntry[] = []
    for (const { html, text } of domSentences) {
      entries.push({ html, text, globalIdx: sentences.length })
      sentences.push({ html, text, parent: el, absTop })
    }
    sentencesByParent.set(el, entries)
  }

  return { sentences, sentencesByParent }
}

export function scoreSentence(s: Sentence, pageHeight: number): number {
  let score = Math.max(0, 200 - s.text.length)
  if (pageHeight > 0 && s.absTop / pageHeight < 0.2) score -= 15
  return score
}
