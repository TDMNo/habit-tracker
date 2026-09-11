import type { SessionUser, TrackerState } from './types'

const USER_KEY = 'habit-tracker:cached-user:v1'

function stateKey(userId: string) {
  return `habit-tracker:user:${userId}:state:v3`
}

export function blankState(): TrackerState {
  return { version: 3, days: {}, pendingEntries: {} }
}

function isTrackerState(value: unknown): value is TrackerState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<TrackerState>
  return state.version === 3 && !!state.days && typeof state.days === 'object'
    && !!state.pendingEntries && typeof state.pendingEntries === 'object'
}

export function loadState(userId: string): TrackerState {
  try {
    const saved = localStorage.getItem(stateKey(userId))
    if (!saved) return blankState()
    const parsed: unknown = JSON.parse(saved)
    if (isTrackerState(parsed)) return parsed
  } catch {
    // Corrupt or blocked cache must never prevent the app from starting.
  }
  return blankState()
}

export function saveState(userId: string, state: TrackerState): void {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state))
  } catch {
    // Server remains source of truth if browser storage is unavailable.
  }
}

export function loadCachedUser(): SessionUser | null {
  try {
    const saved = localStorage.getItem(USER_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<SessionUser>
    if (typeof parsed.id === 'string' && typeof parsed.login === 'string'
      && typeof parsed.displayName === 'string' && (parsed.role === 'user' || parsed.role === 'admin')) {
      return parsed as SessionUser
    }
  } catch {
    // Ignore invalid cache.
  }
  return null
}

export function saveCachedUser(user: SessionUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Authentication still works without a cached offline identity.
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // Nothing else to do.
  }
}
