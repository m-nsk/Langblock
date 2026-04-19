export const REVIEW_FAIL_THRESHOLD = 75
export const REVIEW_MASTERY_STREAK = 2

export interface ReviewItem {
  id: string
  originalText: string
  translatedText: string
  targetLang: string
  addedAt: number
  lastAttemptAt: number
  lastScore: number
  attempts: number
  successStreak: number
  sourceUrl?: string
}

export type ReviewQueue = ReviewItem[]

export interface UpdateReviewMessage {
  type: 'UPDATE_REVIEW'
  originalText: string
  translatedText: string
  targetLang: string
  score: number
  sourceUrl?: string
}

export interface UpdateReviewResponse {
  queue: ReviewQueue
  removed: boolean
}

export function reviewId(targetLang: string, originalText: string): string {
  return `${targetLang}:${originalText}`
}
