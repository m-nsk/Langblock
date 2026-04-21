export function animateCount(
  from: number,
  to: number,
  durationMs: number,
  onTick: (n: number) => void,
): () => void {
  if (from === to) {
    onTick(to)
    return () => {}
  }

  const start = performance.now()
  let frameId: number | null = null
  let cancelled = false

  function frame(now: number) {
    if (cancelled) return
    const t = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - t) * (1 - t)
    const val = Math.round(from + (to - from) * eased)
    onTick(val)
    if (t < 1) {
      frameId = requestAnimationFrame(frame)
    } else {
      frameId = null
    }
  }

  frameId = requestAnimationFrame(frame)

  return () => {
    cancelled = true
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }
}
