export const POINTS_THRESHOLD = 80

export interface Rank {
  name: string
  minPoints: number
  bg: string
  border: string
  accent: string
  text: string
}

export const RANKS: Rank[] = [
  { name: 'Beginner',   minPoints: 0,     bg: '#f8fafc', border: '#e2e8f0', accent: '#64748b', text: '#1e293b' },
  { name: 'Apprentice', minPoints: 500,   bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', text: '#166534' },
  { name: 'Journeyman', minPoints: 2000,  bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', text: '#1e40af' },
  { name: 'Fluent',     minPoints: 6000,  bg: '#faf5ff', border: '#e9d5ff', accent: '#9333ea', text: '#6b21a8' },
  { name: 'Polyglot',   minPoints: 15000, bg: '#fffbeb', border: '#fde68a', accent: '#d97706', text: '#92400e' },
]

export function getRank(points: number): { rank: Rank; next: Rank | null; progress: number } {
  let rank = RANKS[0]
  for (const r of RANKS) {
    if (points >= r.minPoints) rank = r
    else break
  }
  const idx = RANKS.indexOf(rank)
  const next = RANKS[idx + 1] ?? null
  const progress = next
    ? Math.min(1, (points - rank.minPoints) / (next.minPoints - rank.minPoints))
    : 1
  return { rank, next, progress }
}

export interface PointsState {
  pointsTotal: number
  showPointsOverlay: boolean
  streakDays: number
  lastActiveDate: string
}

export interface GetPointsStateMessage {
  type: 'GET_POINTS_STATE'
}

export interface SetPointsOverlayMessage {
  type: 'SET_POINTS_OVERLAY'
  show: boolean
}

export interface AwardPointsMessage {
  type: 'AWARD_POINTS'
  originalText: string
  pct: number
}

export interface AwardPointsResponse extends PointsState {
  awardedPoints: number
}

export const DEFAULT_POINTS_STATE: PointsState = {
  pointsTotal: 0,
  showPointsOverlay: false,
  streakDays: 0,
  lastActiveDate: '',
}

export function normalizePointsState(raw: Partial<PointsState> | null | undefined): PointsState {
  return {
    pointsTotal: raw?.pointsTotal ?? DEFAULT_POINTS_STATE.pointsTotal,
    showPointsOverlay: raw?.showPointsOverlay ?? DEFAULT_POINTS_STATE.showPointsOverlay,
    streakDays: raw?.streakDays ?? DEFAULT_POINTS_STATE.streakDays,
    lastActiveDate: raw?.lastActiveDate ?? DEFAULT_POINTS_STATE.lastActiveDate,
  }
}

export function calculateAwardedPoints(originalText: string, pct: number): number {
  if (pct < POINTS_THRESHOLD) return 0
  return Math.round(originalText.length * (pct / 100))
}
