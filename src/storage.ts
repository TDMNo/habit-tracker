import { localDateKey } from './date'
import type { Habit, TrackerState } from './types'

const STORAGE_KEY = 'habit-tracker:state:v2'
const LEGACY_KEY = 'habit-tracker:today:v1'

interface LegacyHabit extends Omit<Habit, 'createdAt'> {
  value: number
}

function starterState(): TrackerState {
  const now = new Date().toISOString()
  const today = localDateKey()
  const habits: Habit[] = [
    { id: 'water', title: 'Вода', emoji: '💧', type: 'count', target: 8, unit: 'стаканов', color: 'blue', createdAt: now },
    { id: 'english', title: 'Английский', emoji: '📚', type: 'duration', target: 30, unit: 'мин', color: 'violet', createdAt: now },
    { id: 'stretching', title: 'Зарядка', emoji: '⚡', type: 'binary', target: 1, unit: '', color: 'orange', createdAt: now },
  ]

  return {
    version: 2,
    habits,
    entries: {
      [today]: {
        water: { habitId: 'water', date: today, value: 5, updatedAt: now },
        english: { habitId: 'english', date: today, value: 20, updatedAt: now },
      },
    },
  }
}

function isTrackerState(value: unknown): value is TrackerState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<TrackerState>
  return state.version === 2 && Array.isArray(state.habits) && !!state.entries && typeof state.entries === 'object'
}

function migrateLegacy(habits: LegacyHabit[]): TrackerState {
  const now = new Date().toISOString()
  const today = localDateKey()
  const entries: TrackerState['entries'] = {}

  const migratedHabits = habits.map(({ value, ...habit }) => {
    if (Number.isFinite(value) && value > 0) {
      entries[today] ??= {}
      entries[today][habit.id] = {
        habitId: habit.id,
        date: today,
        value: Math.max(0, Math.min(value, habit.target)),
        updatedAt: now,
      }
    }
    return { ...habit, createdAt: now }
  })

  return { version: 2, habits: migratedHabits, entries }
}

export function loadState(): TrackerState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (isTrackerState(parsed)) return parsed
    }

    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy)
      if (Array.isArray(parsed)) {
        const migrated = migrateLegacy(parsed as LegacyHabit[])
        saveState(migrated)
        return migrated
      }
    }
  } catch {
    // Invalid or blocked browser storage falls back to a clean in-memory state.
  }

  return starterState()
}

export function saveState(state: TrackerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // UI remains usable when private mode or browser policy blocks storage.
  }
}
