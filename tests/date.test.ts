import assert from 'node:assert/strict'
import test from 'node:test'
import { localDateKey, parseLocalDateKey, shiftDateKey } from '../src/date'

test('localDateKey uses local calendar components', () => {
  const date = new Date(2026, 0, 5, 23, 59, 0)
  assert.equal(localDateKey(date), '2026-01-05')
})

test('parseLocalDateKey creates a local date', () => {
  const date = parseLocalDateKey('2026-09-11')
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 8)
  assert.equal(date.getDate(), 11)
})

test('shiftDateKey crosses month boundaries safely', () => {
  assert.equal(shiftDateKey('2026-01-31', 1), '2026-02-01')
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28')
})
