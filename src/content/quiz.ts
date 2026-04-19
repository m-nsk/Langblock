import type { AwardPointsResponse } from '../shared/points'

export function requestScore(textA: string, textB: string): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SCORE_SIMILARITY', textA, textB },
      (response: { score?: number; error?: string } | null) => {
        resolve(response?.score ?? 0)
      },
    )
  })
}

export function requestAwardPoints(originalText: string, pct: number): Promise<AwardPointsResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'AWARD_POINTS', originalText, pct },
      (response: AwardPointsResponse | null) => {
        resolve(
          response ?? {
            pointsTotal: 0,
            showPointsOverlay: false,
            streakDays: 0,
            lastActiveDate: '',
            awardedPoints: 0,
          },
        )
      },
    )
  })
}

/**
 * Scale the raw semantic-similarity score down when the attempt is shorter
 * than the reference, so one-word guesses can't trivially pass the threshold.
 */
export function coverageAdjustedPct(rawPct: number, attempt: string, originalText: string): number {
  const attemptWords = attempt.split(/\s+/).filter(Boolean).length
  const originalWords = originalText.split(/\s+/).filter(Boolean).length
  const coverageFactor =
    originalWords > 0 ? Math.sqrt(Math.min(1, attemptWords / originalWords)) : 1
  return Math.round(rawPct * coverageFactor)
}
