import assert from 'node:assert/strict'
import test from 'node:test'
import { queueHabitChange } from '../src/habitState'
import type { Habit, TrackerState } from '../src/types'

const habit: Habit = {
  id: 'habit-1',
  title: 'Чтение',
  emoji: '📚',
  type: 'duration',
  target: 20,
  unit: 'мин',
  color: 'lime',
}

function state(): TrackerState {
  return {
    version: 5,
    days: {
      '2026-09-10': { habits: [habit], entries: {} },
      '2026-09-11': { habits: [habit], entries: { 'habit-1': { habitId: 'habit-1', date: '2026-09-11', value: 10, updatedAt: 'now' } } },
      '2026-09-12': { habits: [habit], entries: { 'habit-1': { habitId: 'habit-1', date: '2026-09-12', value: 5, updatedAt: 'now' } } },
    },
    pendingEntries: {
      '2026-09-12': { 'habit-1': 5 },
    },
    pendingHabits: {},
    pendingHabitChanges: {},
  }
}

test('target edit affects effective date forward but keeps older target history in cache', () => {
  const next = queueHabitChange(state(), {
    habitId: 'habit-1',
    title: 'Чтение книг',
    emoji: '📚',
    color: 'lime',
    target: 30,
    unit: 'мин',
    effectiveDate: '2026-09-11',
    updatedAt: '2026-09-11T12:00:00.000Z',
  })

  assert.equal(next.days['2026-09-10'].habits[0].title, 'Чтение книг')
  assert.equal(next.days['2026-09-10'].habits[0].target, 20)
  assert.equal(next.days['2026-09-11'].habits[0].target, 30)
  assert.equal(next.days['2026-09-12'].habits[0].target, 30)
  assert.equal(Object.keys(next.pendingHabitChanges).length, 1)
})

test('archive hides only dates from archivedOn and drops unsynced future entries', () => {
  const next = queueHabitChange(state(), {
    habitId: 'habit-1',
    title: 'Чтение',
    emoji: '📚',
    color: 'lime',
    target: 20,
    unit: 'мин',
    effectiveDate: '2026-09-11',
    archivedOn: '2026-09-12',
    updatedAt: '2026-09-11T12:00:00.000Z',
  })

  assert.equal(next.days['2026-09-11'].habits.length, 1)
  assert.equal(next.days['2026-09-11'].entries['habit-1'].value, 10)
  assert.equal(next.days['2026-09-12'].habits.length, 0)
  assert.equal(next.days['2026-09-12'].entries['habit-1'], undefined)
  assert.equal(next.pendingEntries['2026-09-12'], undefined)
})
