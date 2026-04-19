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

export function dateISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayDateLocal(): string {
  return dateISO(new Date())
}
