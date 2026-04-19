export interface ActivityEntry {
  count: number
  points: number
}

export type ActivityLog = Record<string, ActivityEntry>

export interface RecordActivityMessage {
  type: 'RECORD_ACTIVITY'
  pointsEarned: number
}

export interface RecordActivityResponse {
  activityLog: ActivityLog
}

export function todayDateUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dateISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}
