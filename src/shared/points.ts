export const POINTS_THRESHOLD = 80

export interface PointsState {
  pointsTotal: number
  showPointsOverlay: boolean
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
}

export function normalizePointsState(raw: Partial<PointsState> | null | undefined): PointsState {
  return {
    pointsTotal: raw?.pointsTotal ?? DEFAULT_POINTS_STATE.pointsTotal,
    showPointsOverlay: raw?.showPointsOverlay ?? DEFAULT_POINTS_STATE.showPointsOverlay,
  }
}

export function calculateAwardedPoints(originalText: string, pct: number): number {
  if (pct < POINTS_THRESHOLD) return 0
  return Math.round(originalText.length * (pct / 100))
}
