export type HabitType = 'binary' | 'count' | 'duration'

export interface Habit {
  id: string
  title: string
  emoji: string
  type: HabitType
  target: number
  value: number
  unit: string
  color: 'lime' | 'blue' | 'violet' | 'orange'
}
