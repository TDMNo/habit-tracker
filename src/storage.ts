import type { Habit } from './types'

const STORAGE_KEY = 'habit-tracker:today:v1'

export const starterHabits: Habit[] = [
  { id: 'water', title: 'Вода', emoji: '💧', type: 'count', target: 8, value: 5, unit: 'стаканов', color: 'blue' },
  { id: 'english', title: 'Английский', emoji: '📚', type: 'duration', target: 30, value: 20, unit: 'мин', color: 'violet' },
  { id: 'stretching', title: 'Зарядка', emoji: '⚡', type: 'binary', target: 1, value: 0, unit: '', color: 'orange' },
]

export function loadHabits(): Habit[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Habit[]) : starterHabits
  } catch {
    return starterHabits
  }
}

export function saveHabits(habits: Habit[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits))
  } catch {
    // The UI remains usable when private mode or browser policy blocks storage.
  }
}
