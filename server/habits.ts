import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from './db'
import { requireAuth } from './auth'

const habitTypes = new Set(['binary', 'count', 'duration'])
const habitColors = new Set(['lime', 'blue', 'violet', 'orange'])
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000_000 ? parsed : null
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

type HabitCreationRow = {
  id: string
  user_id: string
  title: string
  emoji: string
  type: string
  color: string
  position: number
  start_date: string
  target: number
  unit: string
}

function habitResponse(row: HabitCreationRow) {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    type: row.type,
    color: row.color,
    position: row.position,
    startDate: row.start_date,
    target: row.target,
    unit: row.unit,
    value: 0,
  }
}

function sameCreation(row: HabitCreationRow, input: {
  title: string
  emoji: string
  type: string
  color: string
  startDate: string
  target: number
  unit: string
}) {
  return row.title === input.title
    && row.emoji === input.emoji
    && row.type === input.type
    && row.color === input.color
    && row.start_date === input.startDate
    && Number(row.target) === input.target
    && row.unit === input.unit
}

async function findHabitCreation(id: string): Promise<HabitCreationRow | undefined> {
  const result = await pool.query<HabitCreationRow>(
    `SELECT h.id, h.user_id, h.title, h.emoji, h.type, h.color, h.position,
            h.start_date::text AS start_date, ht.target, ht.unit
     FROM habits h
     JOIN habit_targets ht
       ON ht.habit_id = h.id AND ht.effective_from = h.start_date
     WHERE h.id = $1`,
    [id],
  )
  return result.rows[0]
}

export const habitsRouter = Router()
habitsRouter.use(requireAuth)

habitsRouter.get('/', async (request, response, next) => {
  try {
    const date = request.query.date
    if (!validDate(date)) {
      response.status(400).json({ error: 'valid_date_required' })
      return
    }

    const result = await pool.query(
      `SELECT h.id, h.title, h.emoji, h.type, h.color, h.position, h.start_date,
              target.target, target.unit, COALESCE(entry.value, 0)::int AS value
       FROM habits h
       JOIN LATERAL (
         SELECT ht.target, ht.unit
         FROM habit_targets ht
         WHERE ht.habit_id = h.id AND ht.effective_from <= $2::date
         ORDER BY ht.effective_from DESC
         LIMIT 1
       ) target ON TRUE
       LEFT JOIN habit_entries entry
         ON entry.habit_id = h.id AND entry.entry_date = $2::date
       WHERE h.user_id = $1
         AND h.start_date <= $2::date
         AND (h.archived_on IS NULL OR h.archived_on > $2::date)
       ORDER BY h.position, h.created_at`,
      [request.session.userId, date],
    )

    response.json({ date, habits: result.rows })
  } catch (error) {
    next(error)
  }
})

habitsRouter.post('/', async (request, response, next) => {
  const requestedId = text(request.body?.id, 64)
  const title = text(request.body?.title, 80)
  const emoji = text(request.body?.emoji, 16) || '✨'
  const type = text(request.body?.type, 16)
  const color = text(request.body?.color, 16) || 'lime'
  const unit = text(request.body?.unit, 24)
  const target = positiveInteger(request.body?.target)
  const startDate = request.body?.startDate

  if ((requestedId && !uuidPattern.test(requestedId)) || !title || !habitTypes.has(type)
    || !habitColors.has(color) || target === null || !validDate(startDate)) {
    response.status(400).json({ error: 'invalid_habit' })
    return
  }

  if (type === 'binary' && target !== 1) {
    response.status(400).json({ error: 'binary_target_must_be_one' })
    return
  }

  const id = requestedId || randomUUID()
  const creationInput = { title, emoji, type, color, startDate, target, unit }

  try {
    const existing = await findHabitCreation(id)
    if (existing) {
      if (existing.user_id !== request.session.userId || !sameCreation(existing, creationInput)) {
        response.status(409).json({ error: 'habit_id_conflict' })
        return
      }
      response.json({ habit: habitResponse(existing) })
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const positionResult = await client.query<{ next_position: number }>(
        'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM habits WHERE user_id = $1',
        [request.session.userId],
      )
      const position = Number(positionResult.rows[0]?.next_position ?? 0)

      const insertResult = await client.query<{ id: string }>(
        `INSERT INTO habits (id, user_id, title, emoji, type, color, position, start_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [id, request.session.userId, title, emoji, type, color, position, startDate],
      )

      if (!insertResult.rows[0]) {
        await client.query('ROLLBACK')
        const raced = await findHabitCreation(id)
        if (!raced || raced.user_id !== request.session.userId || !sameCreation(raced, creationInput)) {
          response.status(409).json({ error: 'habit_id_conflict' })
          return
        }
        response.json({ habit: habitResponse(raced) })
        return
      }

      await client.query(
        `INSERT INTO habit_targets (habit_id, effective_from, target, unit)
         VALUES ($1, $2::date, $3, $4)`,
        [id, startDate, target, unit],
      )
      await client.query('COMMIT')

      response.status(201).json({
        habit: { id, title, emoji, type, color, position, startDate, target, unit, value: 0 },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    next(error)
  }
})

habitsRouter.patch('/:habitId', async (request, response, next) => {
  try {
    const { habitId } = request.params
    const title = text(request.body?.title, 80)
    const emoji = text(request.body?.emoji, 16) || '✨'
    const color = text(request.body?.color, 16)

    if (!title || !habitColors.has(color)) {
      response.status(400).json({ error: 'invalid_habit_update' })
      return
    }

    const result = await pool.query(
      `UPDATE habits
       SET title = $3, emoji = $4, color = $5, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, emoji, type, color`,
      [habitId, request.session.userId, title, emoji, color],
    )

    if (!result.rows[0]) {
      response.status(404).json({ error: 'habit_not_found' })
      return
    }

    response.json({ habit: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

habitsRouter.put('/:habitId/archive', async (request, response, next) => {
  try {
    const { habitId } = request.params
    const archivedOn = request.body?.archivedOn
    if (!validDate(archivedOn)) {
      response.status(400).json({ error: 'invalid_archive_date' })
      return
    }

    const result = await pool.query<{ id: string }>(
      `UPDATE habits
       SET archived_on = $3::date, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND start_date <= $3::date
       RETURNING id`,
      [habitId, request.session.userId, archivedOn],
    )

    if (!result.rows[0]) {
      const exists = await pool.query<{ start_date: string }>(
        'SELECT start_date::text AS start_date FROM habits WHERE id = $1 AND user_id = $2',
        [habitId, request.session.userId],
      )
      if (!exists.rows[0]) response.status(404).json({ error: 'habit_not_found' })
      else response.status(400).json({ error: 'archive_before_start' })
      return
    }

    response.json({ archive: { habitId, archivedOn } })
  } catch (error) {
    next(error)
  }
})

habitsRouter.put('/:habitId/entries/:date', async (request, response, next) => {
  try {
    const { habitId, date } = request.params
    const value = nonNegativeInteger(request.body?.value)
    if (!validDate(date) || value === null) {
      response.status(400).json({ error: 'invalid_entry' })
      return
    }

    const habitResult = await pool.query<{ type: string }>(
      `SELECT type
       FROM habits
       WHERE id = $1 AND user_id = $2
         AND start_date <= $3::date
         AND (archived_on IS NULL OR archived_on > $3::date)`,
      [habitId, request.session.userId, date],
    )
    const habit = habitResult.rows[0]
    if (!habit) {
      response.status(404).json({ error: 'habit_not_found' })
      return
    }
    if (habit.type === 'binary' && value !== 0 && value !== 1) {
      response.status(400).json({ error: 'binary_value_must_be_zero_or_one' })
      return
    }

    if (value === 0) {
      await pool.query(
        'DELETE FROM habit_entries WHERE habit_id = $1 AND entry_date = $2::date',
        [habitId, date],
      )
    } else {
      await pool.query(
        `INSERT INTO habit_entries (habit_id, entry_date, value)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (habit_id, entry_date)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [habitId, date, value],
      )
    }

    response.json({ entry: { habitId, date, value } })
  } catch (error) {
    next(error)
  }
})

habitsRouter.put('/:habitId/target', async (request, response, next) => {
  try {
    const { habitId } = request.params
    const effectiveFrom = request.body?.effectiveFrom
    const target = positiveInteger(request.body?.target)
    const unit = text(request.body?.unit, 24)

    if (!validDate(effectiveFrom) || target === null) {
      response.status(400).json({ error: 'invalid_target' })
      return
    }

    const habitResult = await pool.query<{ type: string }>(
      'SELECT type FROM habits WHERE id = $1 AND user_id = $2',
      [habitId, request.session.userId],
    )
    const habit = habitResult.rows[0]
    if (!habit) {
      response.status(404).json({ error: 'habit_not_found' })
      return
    }
    if (habit.type === 'binary' && target !== 1) {
      response.status(400).json({ error: 'binary_target_must_be_one' })
      return
    }

    await pool.query(
      `INSERT INTO habit_targets (habit_id, effective_from, target, unit)
       VALUES ($1, $2::date, $3, $4)
       ON CONFLICT (habit_id, effective_from)
       DO UPDATE SET target = EXCLUDED.target, unit = EXCLUDED.unit`,
      [habitId, effectiveFrom, target, unit],
    )

    response.json({ target: { habitId, effectiveFrom, target, unit } })
  } catch (error) {
    next(error)
  }
})
