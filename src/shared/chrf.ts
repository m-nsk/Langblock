export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

function ngramCounts(chars: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>()
  if (chars.length < n) return counts
  for (let i = 0; i <= chars.length - n; i++) {
    const gram = chars.slice(i, i + n).join('')
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }
  return counts
}

function overlap(hyp: Map<string, number>, ref: Map<string, number>): number {
  let sum = 0
  for (const [gram, h] of hyp) {
    const r = ref.get(gram)
    if (r !== undefined) sum += Math.min(h, r)
  }
  return sum
}

function totalCount(m: Map<string, number>): number {
  let sum = 0
  for (const v of m.values()) sum += v
  return sum
}

export function chrF(a: string, b: string, nMax = 6, beta = 2): number {
  const hypChars = Array.from(normalize(a))
  const refChars = Array.from(normalize(b))

  const precisions: number[] = []
  const recalls: number[] = []

  for (let n = 1; n <= nMax; n++) {
    const hyp = ngramCounts(hypChars, n)
    const ref = ngramCounts(refChars, n)
    const hypTotal = totalCount(hyp)
    const refTotal = totalCount(ref)
    if (hypTotal === 0 || refTotal === 0) continue
    const over = overlap(hyp, ref)
    precisions.push(over / hypTotal)
    recalls.push(over / refTotal)
  }

  if (precisions.length === 0) return 0

  const avgP = precisions.reduce((s, x) => s + x, 0) / precisions.length
  const avgR = recalls.reduce((s, x) => s + x, 0) / recalls.length
  const b2 = beta * beta
  const denom = b2 * avgP + avgR
  if (denom === 0) return 0
  return ((1 + b2) * avgP * avgR) / denom
}
