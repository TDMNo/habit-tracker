import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ApiError,
  archiveHabit,
  createHabit as createServerHabit,
  fetchDay,
  getSessionUser,
  login,
  logout,
  saveHabitEntry,
  saveHabitTarget,
  updateHabitDefinition,
} from './api'
import { daysAround, localDateKey, parseLocalDateKey, shiftDateKey } from './date'
import { hasPendingWork, overlayHabitChanges, pendingHabitChangeKey, queueHabitChange } from './habitState'
import { LoginScreen } from './LoginScreen'
import { blankState, clearCachedUser, loadCachedUser, loadState, saveCachedUser, saveState } from './storage'
import type { Habit, HabitEntry, HabitType, PendingHabit, PendingHabitChange, SessionUser, TrackerState } from './types'

type AuthMode = 'checking' | 'authenticated' | 'offline' | 'guest' | 'unavailable'
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

function completion(habit: Habit, value: number): number {
  if (habit.target <= 0) return 0
  return Math.min(Math.max(value, 0) / habit.target, 1)
}

function mergeHabits(serverHabits: Habit[], pendingHabits: PendingHabit[], date: string): Habit[] {
  const byId = new Map(serverHabits.map((habit) => [habit.id, habit]))
  for (const pending of pendingHabits) {
    if (pending.startDate <= date && !byId.has(pending.habit.id)) byId.set(pending.habit.id, pending.habit)
  }
  return [...byId.values()]
}

function App() {
  const initialUser = useMemo(() => loadCachedUser(), [])
  const [user, setUser] = useState<SessionUser | null>(initialUser)
  const [authMode, setAuthMode] = useState<AuthMode>('checking')
  const [state, setState] = useState<TrackerState>(() => initialUser ? loadState(initialUser.id) : blankState())
  const [selectedDate, setSelectedDate] = useState(localDateKey)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(initialUser ? 'syncing' : 'idle')
  const [loadingDay, setLoadingDay] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<HabitType>('binary')
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editError, setEditError] = useState('')

  const userRef = useRef<SessionUser | null>(initialUser)
  const stateRef = useRef(state)
  const authRef = useRef<AuthMode>('checking')
  const flushingRef = useRef(false)

  const weekDays = useMemo(() => daysAround(selectedDate), [selectedDate])
  const selectedDateObject = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate])
  const isToday = selectedDate === localDateKey()
  const day = state.days[selectedDate]
  const pendingHabitList = useMemo(() => Object.values(state.pendingHabits), [state.pendingHabits])
  const pendingChangeList = useMemo(() => Object.values(state.pendingHabitChanges), [state.pendingHabitChanges])
  const habits = useMemo(() => {
    const withCreations = mergeHabits(day?.habits ?? [], pendingHabitList, selectedDate)
    return overlayHabitChanges(withCreations, pendingChangeList, selectedDate)
  }, [day?.habits, pendingChangeList, pendingHabitList, selectedDate])
  const pendingChangeHabitIds = useMemo(
    () => new Set(pendingChangeList.map((change) => change.habitId)),
    [pendingChangeList],
  )

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { authRef.current = authMode }, [authMode])

  const replaceState = useCallback((next: TrackerState, owner = userRef.current) => {
    stateRef.current = next
    setState(next)
    if (owner) saveState(owner.id, next)
  }, [])

  const updateState = useCallback((updater: (current: TrackerState) => TrackerState) => {
    const current = stateRef.current
    const next = updater(current)
    replaceState(next)
    return next
  }, [replaceState])

  const clearIdentity = useCallback((mode: AuthMode = 'guest') => {
    clearCachedUser()
    userRef.current = null
    setUser(null)
    authRef.current = mode
    setAuthMode(mode)
    replaceState(blankState(), null)
    setSyncStatus(mode === 'unavailable' ? 'error' : 'idle')
  }, [replaceState])

  const establishIdentity = useCallback((nextUser: SessionUser, mode: AuthMode = 'authenticated') => {
    saveCachedUser(nextUser)
    userRef.current = nextUser
    setUser(nextUser)
    const cached = loadState(nextUser.id)
    replaceState(cached, nextUser)
    authRef.current = mode
    setAuthMode(mode)
    setSyncStatus(mode === 'offline' ? 'offline' : 'syncing')
  }, [replaceState])

  useEffect(() => {
    let cancelled = false
    void getSessionUser()
      .then((remoteUser) => {
        if (cancelled) return
        if (remoteUser) establishIdentity(remoteUser)
        else clearIdentity('guest')
      })
      .catch(() => {
        if (cancelled) return
        if (initialUser) {
          authRef.current = 'offline'
          setAuthMode('offline')
          setSyncStatus('offline')
        } else {
          clearIdentity('unavailable')
        }
      })
    return () => { cancelled = true }
  }, [clearIdentity, establishIdentity, initialUser])

  const refreshDay = useCallback(async (date: string) => {
    if (!userRef.current || authRef.current !== 'authenticated') return
    setLoadingDay(true)
    setSyncStatus('syncing')
    try {
      const remote = await fetchDay(date)
      const current = stateRef.current
      const pendingEntries = current.pendingEntries[date] ?? {}
      const withCreations = mergeHabits(remote.habits, Object.values(current.pendingHabits), date)
      const mergedHabits = overlayHabitChanges(withCreations, Object.values(current.pendingHabitChanges), date)
      const now = new Date().toISOString()
      const entries: Record<string, HabitEntry> = {}

      for (const habit of mergedHabits) {
        const value = Object.hasOwn(pendingEntries, habit.id)
          ? pendingEntries[habit.id]
          : (remote.values[habit.id] ?? 0)
        if (value > 0) entries[habit.id] = { habitId: habit.id, date, value, updatedAt: now }
      }

      const next = updateState((latest) => ({
        ...latest,
        days: {
          ...latest.days,
          [date]: { habits: mergedHabits, entries, syncedAt: now },
        },
      }))
      setSyncStatus(hasPendingWork(next) ? 'syncing' : 'synced')
      setActionError('')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearIdentity('guest')
      else if (error instanceof ApiError) setSyncStatus('error')
      else {
        authRef.current = 'offline'
        setAuthMode('offline')
        setSyncStatus('offline')
      }
    } finally {
      setLoadingDay(false)
    }
  }, [clearIdentity, updateState])

  const handleSyncFailure = useCallback((error: unknown, message = 'Не удалось синхронизировать изменения.') => {
    if (error instanceof ApiError && error.status === 401) {
      clearIdentity('guest')
    } else if (error instanceof ApiError) {
      setActionError(message)
      setSyncStatus('error')
    } else {
      authRef.current = 'offline'
      setAuthMode('offline')
      setSyncStatus('offline')
    }
  }, [clearIdentity])

  const flushSyncQueue = useCallback(async () => {
    if (flushingRef.current || authRef.current !== 'authenticated' || !userRef.current) return
    flushingRef.current = true
    setSyncStatus('syncing')

    try {
      while (authRef.current === 'authenticated') {
        const pendingHabit = Object.values(stateRef.current.pendingHabits)[0]
        if (pendingHabit) {
          try {
            const canonical = await createServerHabit({
              id: pendingHabit.habit.id,
              title: pendingHabit.habit.title,
              emoji: pendingHabit.habit.emoji,
              type: pendingHabit.habit.type,
              color: pendingHabit.habit.color,
              target: pendingHabit.habit.target,
              unit: pendingHabit.habit.unit,
              startDate: pendingHabit.startDate,
            })

            updateState((current) => {
              if (!current.pendingHabits[pendingHabit.habit.id]) return current
              const pendingHabits = { ...current.pendingHabits }
              delete pendingHabits[pendingHabit.habit.id]

              const days = { ...current.days }
              for (const [date, cache] of Object.entries(days)) {
                if (date < pendingHabit.startDate) continue
                const byId = new Map(cache.habits.map((habit) => [habit.id, habit]))
                byId.set(canonical.id, canonical)
                days[date] = { ...cache, habits: [...byId.values()] }
              }
              return { ...current, days, pendingHabits }
            })
          } catch (error) {
            handleSyncFailure(error, error instanceof ApiError && error.status === 409
              ? 'Не удалось синхронизировать одну привычку из-за конфликта данных.'
              : 'Не удалось синхронизировать новую привычку.')
            return
          }
          continue
        }

        const pendingChangeEntry = Object.entries(stateRef.current.pendingHabitChanges)
          .sort(([, a], [, b]) => a.effectiveDate.localeCompare(b.effectiveDate) || a.updatedAt.localeCompare(b.updatedAt))[0]
        if (pendingChangeEntry) {
          const [key, change] = pendingChangeEntry
          try {
            await updateHabitDefinition(change.habitId, {
              title: change.title,
              emoji: change.emoji,
              color: change.color,
            })
            await saveHabitTarget(change.habitId, change.effectiveDate, change.target, change.unit)
            if (change.archivedOn) await archiveHabit(change.habitId, change.archivedOn)

            updateState((current) => {
              const latest = current.pendingHabitChanges[key]
              if (!latest || latest.updatedAt !== change.updatedAt) return current
              const pendingHabitChanges = { ...current.pendingHabitChanges }
              delete pendingHabitChanges[key]
              return { ...current, pendingHabitChanges }
            })
          } catch (error) {
            handleSyncFailure(error)
            return
          }
          continue
        }

        const pendingEntries = stateRef.current.pendingEntries
        const date = Object.keys(pendingEntries).find((key) => Object.keys(pendingEntries[key] ?? {}).length > 0)
        if (!date) break
        const habitId = Object.keys(pendingEntries[date])[0]
        const value = pendingEntries[date][habitId]

        try {
          await saveHabitEntry(habitId, date, value)
        } catch (error) {
          handleSyncFailure(error)
          return
        }

        updateState((current) => {
          if (current.pendingEntries[date]?.[habitId] !== value) return current
          const nextPendingEntries = { ...current.pendingEntries }
          const dayPending = { ...nextPendingEntries[date] }
          delete dayPending[habitId]
          if (Object.keys(dayPending).length) nextPendingEntries[date] = dayPending
          else delete nextPendingEntries[date]
          return { ...current, pendingEntries: nextPendingEntries }
        })
      }
      if (authRef.current === 'authenticated') setSyncStatus('synced')
    } finally {
      flushingRef.current = false
    }
  }, [handleSyncFailure, updateState])

  useEffect(() => {
    if (authMode !== 'authenticated' || !user) return
    void flushSyncQueue().then(() => refreshDay(selectedDate))
  }, [authMode, flushSyncQueue, refreshDay, selectedDate, user])

  useEffect(() => {
    const reconnect = () => {
      if (!userRef.current) return
      setSyncStatus('syncing')
      void getSessionUser()
        .then((remoteUser) => {
          if (!remoteUser) {
            clearIdentity('guest')
            return
          }
          saveCachedUser(remoteUser)
          userRef.current = remoteUser
          setUser(remoteUser)
          authRef.current = 'authenticated'
          setAuthMode('authenticated')
          void flushSyncQueue().then(() => refreshDay(selectedDate))
        })
        .catch(() => {
          authRef.current = 'offline'
          setAuthMode('offline')
          setSyncStatus('offline')
        })
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [clearIdentity, flushSyncQueue, refreshDay, selectedDate])

  const handleLogin = async (loginValue: string, password: string) => {
    const nextUser = await login(loginValue, password)
    establishIdentity(nextUser)
  }

  const handleLogout = async () => {
    try {
      if (authRef.current === 'authenticated') await logout()
    } finally {
      clearIdentity('guest')
    }
  }

  const valueFor = (habitId: string) => day?.entries[habitId]?.value ?? 0

  const progress = useMemo(() => {
    if (!habits.length) return 0
    const total = habits.reduce((sum, habit) => sum + completion(habit, day?.entries[habit.id]?.value ?? 0), 0)
    return Math.round((total / habits.length) * 100)
  }, [day, habits])

  const setHabitValue = (habit: Habit, requestedValue: number) => {
    const value = habit.type === 'binary' ? (requestedValue > 0 ? 1 : 0) : Math.max(0, requestedValue)
    const now = new Date().toISOString()

    updateState((current) => {
      const currentDay = current.days[selectedDate] ?? { habits, entries: {} }
      const entries = { ...currentDay.entries }
      if (value === 0) delete entries[habit.id]
      else entries[habit.id] = { habitId: habit.id, date: selectedDate, value, updatedAt: now }

      const pendingEntries = { ...current.pendingEntries }
      pendingEntries[selectedDate] = { ...(pendingEntries[selectedDate] ?? {}), [habit.id]: value }

      return {
        ...current,
        days: { ...current.days, [selectedDate]: { ...currentDay, entries } },
        pendingEntries,
      }
    })

    if (authRef.current === 'authenticated') void flushSyncQueue()
    else setSyncStatus('offline')
  }

  const advanceHabit = (habit: Habit) => {
    const currentValue = valueFor(habit.id)
    const step = habit.type === 'duration' ? 5 : 1
    const nextValue = habit.type === 'binary' && currentValue >= 1 ? 0 : currentValue + step
    setHabitValue(habit, nextValue)
  }

  const decreaseHabit = (habit: Habit) => {
    const step = habit.type === 'duration' ? 5 : 1
    setHabitValue(habit, valueFor(habit.id) - step)
  }

  const addHabit = () => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const defaults = type === 'duration'
      ? { target: 30, unit: 'мин' }
      : type === 'count'
        ? { target: 10, unit: 'раз' }
        : { target: 1, unit: '' }

    const habit: Habit = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      emoji: type === 'duration' ? '⏱️' : type === 'count' ? '🎯' : '✨',
      type,
      color: 'lime',
      ...defaults,
    }
    const createdAt = new Date().toISOString()

    updateState((current) => {
      const currentDay = current.days[selectedDate] ?? { habits: [], entries: {} }
      const byId = new Map(currentDay.habits.map((item) => [item.id, item]))
      byId.set(habit.id, habit)
      return {
        ...current,
        days: {
          ...current.days,
          [selectedDate]: { ...currentDay, habits: [...byId.values()] },
        },
        pendingHabits: {
          ...current.pendingHabits,
          [habit.id]: { habit, startDate: selectedDate, createdAt },
        },
      }
    })

    setTitle('')
    setType('binary')
    setIsAdding(false)
    setActionError('')

    if (authRef.current === 'authenticated') void flushSyncQueue()
    else setSyncStatus('offline')
  }

  const openHabitEditor = (habit: Habit) => {
    setEditingHabit(habit)
    setEditTitle(habit.title)
    setEditTarget(String(habit.target))
    setEditError('')
  }

  const saveHabitEdit = () => {
    if (!editingHabit) return
    const cleanTitle = editTitle.trim()
    const target = editingHabit.type === 'binary' ? 1 : Number(editTarget)
    if (!cleanTitle) {
      setEditError('Нужно название привычки.')
      return
    }
    if (!Number.isInteger(target) || target < 1 || target > 1_000_000) {
      setEditError('Цель должна быть целым положительным числом.')
      return
    }

    const change: PendingHabitChange = {
      habitId: editingHabit.id,
      title: cleanTitle,
      emoji: editingHabit.emoji,
      color: editingHabit.color,
      target,
      unit: editingHabit.unit,
      effectiveDate: selectedDate,
      updatedAt: new Date().toISOString(),
    }
    updateState((current) => queueHabitChange(current, change))
    setEditingHabit(null)
    setEditError('')
    setActionError('')
    if (authRef.current === 'authenticated') void flushSyncQueue()
    else setSyncStatus('offline')
  }

  const archiveEditingHabit = () => {
    if (!editingHabit) return
    const archivedOn = shiftDateKey(selectedDate, 1)
    const change: PendingHabitChange = {
      habitId: editingHabit.id,
      title: editingHabit.title,
      emoji: editingHabit.emoji,
      color: editingHabit.color,
      target: editingHabit.target,
      unit: editingHabit.unit,
      effectiveDate: selectedDate,
      archivedOn,
      updatedAt: new Date().toISOString(),
    }
    updateState((current) => queueHabitChange(current, change))
    setEditingHabit(null)
    setEditError('')
    setActionError('')
    if (authRef.current === 'authenticated') void flushSyncQueue()
    else setSyncStatus('offline')
  }

  if (!user && authMode === 'checking') {
    return <main className="boot-shell"><div className="boot-mark">✓</div><p>Открываем трекер…</p></main>
  }

  if (!user) {
    return <LoginScreen unavailable={authMode === 'unavailable'} onLogin={handleLogin} />
  }

  const completedCount = habits.filter((habit) => completion(habit, valueFor(habit.id)) === 1).length
  const pendingWork = hasPendingWork(state)
  const syncLabel = syncStatus === 'syncing' || authMode === 'checking'
    ? 'Синхронизация…'
    : syncStatus === 'offline' || authMode === 'offline'
      ? (pendingWork ? 'Офлайн · изменения сохранены' : 'Офлайн')
      : syncStatus === 'error'
        ? 'Ошибка синхронизации'
        : pendingWork
          ? 'Ожидает синхронизации'
          : 'Синхронизировано'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow-row">
            <p className="eyebrow">{isToday ? 'Сегодня' : selectedDateObject.toLocaleDateString('ru-RU', { weekday: 'long' })}</p>
            {!isToday && <button className="today-link" type="button" onClick={() => setSelectedDate(localDateKey())}>К сегодня</button>}
          </div>
          <h1>{selectedDateObject.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h1>
          <p className={`sync-status ${syncStatus}`}>{syncLabel}</p>
        </div>
        <button className="avatar" type="button" onClick={handleLogout} aria-label={`Выйти из аккаунта ${user.displayName}`} title="Выйти">
          {(user.displayName || user.login).slice(0, 1).toUpperCase()}
        </button>
      </header>

      <section className="week-strip" aria-label="Выбор дня">
        {weekDays.map((item) => {
          const active = item.key === selectedDate
          const className = `day${active ? ' active' : ''}${item.isToday && !active ? ' today' : ''}`
          return (
            <button className={className} key={item.key} type="button" onClick={() => setSelectedDate(item.key)} aria-current={active ? 'date' : undefined}>
              <span>{item.day}</span><strong>{item.date}</strong>
            </button>
          )
        })}
      </section>

      <section className="summary-card" aria-label={`Прогресс дня ${progress}%`}>
        <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}>
          <div><strong>{progress}%</strong><span>готово</span></div>
        </div>
        <div className="summary-copy">
          <p>Прогресс дня</p>
          <h2>{progress === 100 && habits.length ? 'День закрыт!' : progress >= 50 ? 'Отличный темп' : 'Начнём с малого'}</h2>
          <span>{completedCount} из {habits.length} привычек выполнено</span>
        </div>
      </section>

      {actionError && <p className="action-error" role="alert">{actionError}</p>}

      <section className="habit-section">
        <div className="section-heading">
          <h2>Мои привычки</h2><span>{habits.length}</span>
        </div>
        <div className="habit-list">
          {habits.map((habit) => {
            const value = valueFor(habit.id)
            const done = completion(habit, value) === 1
            const pending = Boolean(state.pendingHabits[habit.id] || pendingChangeHabitIds.has(habit.id))
            return (
              <article className={`habit-card ${habit.color} ${done ? 'done' : ''} ${pending ? 'pending' : ''}`} key={habit.id}>
                <div className="habit-icon" aria-hidden="true">{habit.emoji}</div>
                <button className="habit-main" type="button" onClick={() => advanceHabit(habit)}>
                  <span className="habit-title">{habit.title}{pending && <em className="pending-badge">не синхр.</em>}</span>
                  <span className="habit-value">{habit.type === 'binary' ? (done ? 'Выполнено' : 'Отметить') : `${value} / ${habit.target} ${habit.unit}`}</span>
                  <span className="habit-track"><i style={{ width: `${completion(habit, value) * 100}%` }} /></span>
                </button>
                <button className="edit-button" type="button" onClick={() => openHabitEditor(habit)} aria-label={`Настроить: ${habit.title}`}>⋯</button>
                {habit.type === 'binary' ? (
                  <button className="check-button" type="button" onClick={() => advanceHabit(habit)} aria-label={done ? `Отменить выполнение: ${habit.title}` : `Выполнить: ${habit.title}`}>{done ? '✓' : ''}</button>
                ) : (
                  <div className="stepper">
                    <button type="button" onClick={() => decreaseHabit(habit)} aria-label={`Уменьшить: ${habit.title}`}>−</button>
                    <button type="button" onClick={() => advanceHabit(habit)} aria-label={`Увеличить: ${habit.title}`}>+</button>
                  </div>
                )}
              </article>
            )
          })}
          {!habits.length && !loadingDay && <div className="empty-state"><strong>Здесь пока пусто</strong><span>{authMode === 'offline' ? 'Для этого дня нет сохранённого кеша.' : 'Добавь первую привычку — займёт пару секунд.'}</span></div>}
          {loadingDay && !habits.length && <div className="empty-state"><strong>Загружаем день…</strong></div>}
        </div>
      </section>

      <button className="add-button" type="button" onClick={() => { setActionError(''); setIsAdding(true) }}><span>+</span> Новая привычка</button>

      {isAdding && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setIsAdding(false)}>
          <section className="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 id="add-title">Новая привычка</h2>
            <label>
              Название
              <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addHabit()} placeholder="Например, прогулка" maxLength={80} />
            </label>
            <fieldset>
              <legend>Как будем считать?</legend>
              <div className="type-grid">
                {([
                  ['binary', '✓', 'Да / нет'],
                  ['count', '#', 'Количество'],
                  ['duration', '◷', 'Время'],
                ] as const).map(([value, icon, label]) => (
                  <button className={type === value ? 'selected' : ''} key={value} type="button" onClick={() => setType(value)}><strong>{icon}</strong><span>{label}</span></button>
                ))}
              </div>
            </fieldset>
            <button className="save-button" type="button" onClick={addHabit} disabled={!title.trim()}>Добавить привычку</button>
          </section>
        </div>
      )}

      {editingHabit && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setEditingHabit(null)}>
          <section className="add-sheet edit-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 id="edit-title">Настроить привычку</h2>
            <p className="sheet-note">Название обновится везде. Новая цель действует с выбранного дня, а прошлая история сохраняется.</p>
            {editError && <p className="sheet-error" role="alert">{editError}</p>}
            <label>
              Название
              <input autoFocus value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} />
            </label>
            {editingHabit.type !== 'binary' && (
              <label className="target-field">
                Цель с {selectedDateObject.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                <input type="number" min="1" max="1000000" inputMode="numeric" value={editTarget} onChange={(event) => setEditTarget(event.target.value)} />
              </label>
            )}
            <button className="save-button" type="button" onClick={saveHabitEdit} disabled={!editTitle.trim()}>Сохранить изменения</button>
            <button className="archive-button" type="button" onClick={archiveEditingHabit}>Архивировать после этого дня</button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
