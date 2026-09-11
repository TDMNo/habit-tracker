export type HabitType = 'binary' | 'count' | 'duration'
export type HabitColor = 'lime' | 'blue' | 'violet' | 'orange'

export interface Habit {
  id: string
  title: string
  emoji: string
  type: HabitType
  target: number
  unit: string
  color: HabitColor
  createdAt: string
}

export interface HabitEntry {
  habitId: string
  date: string
  value: number
  updatedAt: string
}

export interface TrackerState {
  version: 2
  habits: Habit[]
  entries: Record<string, Record<string, HabitEntry>>
}
