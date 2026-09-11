import type { Habit, PendingHabitChange, TrackerState } from './types'

export function pendingHabitChangeKey(change: Pick<PendingHabitChange, 'habitId' | 'effectiveDate'>): string {
  return `${change.habitId}:${change.effectiveDate}`
}

export function overlayHabitChanges(habits: Habit[], changes: PendingHabitChange[], date: string): Habit[] {
  let current = habits
  const ordered = [...changes].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))

  for (const change of ordered) {
    if (change.archivedOn && date >= change.archivedOn) {
      current = current.filter((habit) => habit.id !== change.habitId)
      continue
    }

    current = current.map((habit) => {
      if (habit.id !== change.habitId) return habit
      return {
        ...habit,
        title: change.title,
        emoji: change.emoji,
        color: change.color,
        ...(date >= change.effectiveDate ? { target: change.target, unit: change.unit } : {}),
      }
    })
  }

  return current
}

export function applyHabitChange(state: TrackerState, change: PendingHabitChange): TrackerState {
  const days = Object.fromEntries(Object.entries(state.days).map(([date, cache]) => {
    const archived = Boolean(change.archivedOn && date >= change.archivedOn)
    const habits = cache.habits
      .filter((habit) => !(archived && habit.id === change.habitId))
      .map((habit) => {
        if (habit.id !== change.habitId) return habit
        return {
          ...habit,
          title: change.title,
          emoji: change.emoji,
          color: change.color,
          ...(date >= change.effectiveDate ? { target: change.target, unit: change.unit } : {}),
        }
      })

    if (!archived) return [date, { ...cache, habits }]
    const entries = { ...cache.entries }
    delete entries[change.habitId]
    return [date, { ...cache, habits, entries }]
  }))

  const pendingEntries = { ...state.pendingEntries }
  if (change.archivedOn) {
    for (const date of Object.keys(pendingEntries)) {
      if (date < change.archivedOn || !Object.hasOwn(pendingEntries[date], change.habitId)) continue
      const dayPending = { ...pendingEntries[date] }
      delete dayPending[change.habitId]
      if (Object.keys(dayPending).length) pendingEntries[date] = dayPending
      else delete pendingEntries[date]
    }
  }

  const pendingHabits = { ...state.pendingHabits }
  const pendingHabit = pendingHabits[change.habitId]
  if (pendingHabit) {
    pendingHabits[change.habitId] = {
      ...pendingHabit,
      habit: {
        ...pendingHabit.habit,
        title: change.title,
        emoji: change.emoji,
        color: change.color,
        ...(change.effectiveDate <= pendingHabit.startDate ? { target: change.target, unit: change.unit } : {}),
      },
    }
  }

  return { ...state, days, pendingEntries, pendingHabits }
}

export function queueHabitChange(state: TrackerState, change: PendingHabitChange): TrackerState {
  const changed = applyHabitChange(state, change)
  const pendingHabitChanges = Object.fromEntries(
    Object.entries(changed.pendingHabitChanges).map(([key, current]) => [
      key,
      current.habitId === change.habitId
        ? { ...current, title: change.title, emoji: change.emoji, color: change.color }
        : current,
    ]),
  )
  const key = pendingHabitChangeKey(change)
  pendingHabitChanges[key] = {
    ...pendingHabitChanges[key],
    ...change,
    archivedOn: change.archivedOn ?? pendingHabitChanges[key]?.archivedOn,
  }
  return { ...changed, pendingHabitChanges }
}

export function hasPendingWork(state: TrackerState): boolean {
  return Object.keys(state.pendingHabits).length > 0
    || Object.keys(state.pendingHabitChanges).length > 0
    || Object.values(state.pendingEntries).some((day) => Object.keys(day).length > 0)
}
