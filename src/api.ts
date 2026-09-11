import type { Habit, HabitColor, HabitType, SessionUser } from './types'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let code = `http_${response.status}`
    try {
      const body = await response.json() as { error?: string }
      if (body.error) code = body.error
    } catch {
      // Keep the status-based error when a proxy returns non-JSON content.
    }
    throw new ApiError(response.status, code)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const data = await request<{ user: SessionUser | null }>('/api/auth/me')
  return data.user
}

export async function login(loginValue: string, password: string): Promise<SessionUser> {
  const data = await request<{ user: SessionUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: loginValue, password }),
  })
  return data.user
}

export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' })
}

type HabitRow = {
  id: string
  title: string
  emoji: string
  type: HabitType
  color: HabitColor
  target: number
  unit: string
  value: number
}

export async function fetchDay(date: string): Promise<{ habits: Habit[]; values: Record<string, number> }> {
  const data = await request<{ date: string; habits: HabitRow[] }>(`/api/habits?date=${encodeURIComponent(date)}`)
  const values: Record<string, number> = {}
  const habits = data.habits.map(({ value, ...habit }) => {
    values[habit.id] = Number(value) || 0
    return habit
  })
  return { habits, values }
}

export async function createHabit(input: {
  title: string
  emoji: string
  type: HabitType
  color: HabitColor
  target: number
  unit: string
  startDate: string
}): Promise<Habit> {
  const data = await request<{ habit: Habit & { value?: number } }>('/api/habits', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const { value: _value, ...habit } = data.habit
  return habit
}

export async function saveHabitEntry(habitId: string, date: string, value: number): Promise<void> {
  await request(`/api/habits/${encodeURIComponent(habitId)}/entries/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}
