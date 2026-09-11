export type HabitType = 'binary' | 'count' | 'duration'
export type HabitColor = 'lime' | 'blue' | 'violet' | 'orange'

export interface SessionUser {
  id: string
  login: string
  displayName: string
  role: 'user' | 'admin'
}

export interface Habit {
  id: string
  title: string
  emoji: string
  type: HabitType
  target: number
  unit: string
  color: HabitColor
}

export interface HabitEntry {
  habitId: string
  date: string
  value: number
  updatedAt: string
}

export interface DayCache {
  habits: Habit[]
  entries: Record<string, HabitEntry>
  syncedAt?: string
}

export interface PendingHabit {
  habit: Habit
  startDate: string
  createdAt: string
}

export interface TrackerState {
  version: 4
  days: Record<string, DayCache>
  pendingEntries: Record<string, Record<string, number>>
  pendingHabits: Record<string, PendingHabit>
}
