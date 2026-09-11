import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ApiError, createHabit as createServerHabit, fetchDay, getSessionUser, login, logout, saveHabitEntry } from './api'
import { daysAround, localDateKey, parseLocalDateKey } from './date'
import { LoginScreen } from './LoginScreen'
import { blankState, clearCachedUser, loadCachedUser, loadState, saveCachedUser, saveState } from './storage'
import type { Habit, HabitEntry, HabitType, SessionUser, TrackerState } from './types'

type AuthMode = 'checking' | 'authenticated' | 'offline' | 'guest' | 'unavailable'
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

function completion(habit: Habit, value: number): number {
  if (habit.target <= 0) return 0
  return Math.min(Math.max(value, 0) / habit.target, 1)
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
  const [savingHabit, setSavingHabit] = useState(false)

  const userRef = useRef<SessionUser | null>(initialUser)
  const stateRef = useRef(state)
  const authRef = useRef<AuthMode>('checking')
  const flushingRef = useRef(false)

  const weekDays = useMemo(() => daysAround(selectedDate), [selectedDate])
  const selectedDateObject = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate])
  const isToday = selectedDate === localDateKey()
  const day = state.days[selectedDate]
  const habits = day?.habits ?? []

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
      const pending = stateRef.current.pendingEntries[date] ?? {}
      const now = new Date().toISOString()
      const entries: Record<string, HabitEntry> = {}

      for (const habit of remote.habits) {
        const value = Object.hasOwn(pending, habit.id) ? pending[habit.id] : (remote.values[habit.id] ?? 0)
        if (value > 0) entries[habit.id] = { habitId: habit.id, date, value, updatedAt: now }
      }

      updateState((current) => ({
        ...current,
        days: {
          ...current.days,
          [date]: { habits: remote.habits, entries, syncedAt: now },
        },
      }))
      setSyncStatus(Object.keys(pending).length ? 'syncing' : 'synced')
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

  const flushPendingEntries = useCallback(async () => {
    if (flushingRef.current || authRef.current !== 'authenticated' || !userRef.current) return
    flushingRef.current = true
    setSyncStatus('syncing')

    try {
      while (authRef.current === 'authenticated') {
        const pending = stateRef.current.pendingEntries
        const date = Object.keys(pending).find((key) => Object.keys(pending[key] ?? {}).length > 0)
        if (!date) break
        const habitId = Object.keys(pending[date])[0]
        const value = pending[date][habitId]

        try {
          await saveHabitEntry(habitId, date, value)
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            clearIdentity('guest')
          } else if (error instanceof ApiError) {
            setSyncStatus('error')
          } else {
            authRef.current = 'offline'
            setAuthMode('offline')
            setSyncStatus('offline')
          }
          return
        }

        updateState((current) => {
          if (current.pendingEntries[date]?.[habitId] !== value) return current
          const pendingEntries = { ...current.pendingEntries }
          const dayPending = { ...pendingEntries[date] }
          delete dayPending[habitId]
          if (Object.keys(dayPending).length) pendingEntries[date] = dayPending
          else delete pendingEntries[date]
          return { ...current, pendingEntries }
        })
      }
      if (authRef.current === 'authenticated') setSyncStatus('synced')
    } finally {
      flushingRef.current = false
    }
  }, [clearIdentity, updateState])

  useEffect(() => {
    if (authMode !== 'authenticated' || !user) return
    void refreshDay(selectedDate).then(() => flushPendingEntries())
  }, [authMode, flushPendingEntries, refreshDay, selectedDate, user])

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
          void flushPendingEntries().then(() => refreshDay(selectedDate))
        })
        .catch(() => {
          authRef.current = 'offline'
          setAuthMode('offline')
          setSyncStatus('offline')
        })
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [clearIdentity, flushPendingEntries, refreshDay, selectedDate])

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

    if (authRef.current === 'authenticated') void flushPendingEntries()
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

  const addHabit = async () => {
    const cleanTitle = title.trim()
    if (!cleanTitle || savingHabit) return
    if (authRef.current !== 'authenticated') {
      setActionError('Для создания новой привычки нужно подключение к серверу.')
      return
    }

    const defaults = type === 'duration'
      ? { target: 30, unit: 'мин' }
      : type === 'count'
        ? { target: 10, unit: 'раз' }
        : { target: 1, unit: '' }

    setSavingHabit(true)
    setActionError('')
    try {
      const habit = await createServerHabit({
        title: cleanTitle,
        emoji: type === 'duration' ? '⏱️' : type === 'count' ? '🎯' : '✨',
        type,
        color: 'lime',
        startDate: selectedDate,
        ...defaults,
      })
      updateState((current) => {
        const currentDay = current.days[selectedDate] ?? { habits: [], entries: {} }
        return {
          ...current,
          days: {
            ...current.days,
            [selectedDate]: { ...currentDay, habits: [...currentDay.habits, habit], syncedAt: new Date().toISOString() },
          },
        }
      })
      setTitle('')
      setType('binary')
      setIsAdding(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearIdentity('guest')
      else setActionError('Не удалось создать привычку. Попробуй ещё раз.')
    } finally {
      setSavingHabit(false)
    }
  }

  if (!user && authMode === 'checking') {
    return <main className="boot-shell"><div className="boot-mark">✓</div><p>Открываем трекер…</p></main>
  }

  if (!user) {
    return <LoginScreen unavailable={authMode === 'unavailable'} onLogin={handleLogin} />
  }

  const completedCount = habits.filter((habit) => completion(habit, valueFor(habit.id)) === 1).length
  const syncLabel = syncStatus === 'syncing' || authMode === 'checking'
    ? 'Синхронизация…'
    : syncStatus === 'offline' || authMode === 'offline'
      ? 'Офлайн'
      : syncStatus === 'error'
        ? 'Ошибка синхронизации'
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
            return (
              <article className={`habit-card ${habit.color} ${done ? 'done' : ''}`} key={habit.id}>
                <div className="habit-icon" aria-hidden="true">{habit.emoji}</div>
                <button className="habit-main" type="button" onClick={() => advanceHabit(habit)}>
                  <span className="habit-title">{habit.title}</span>
                  <span className="habit-value">{habit.type === 'binary' ? (done ? 'Выполнено' : 'Отметить') : `${value} / ${habit.target} ${habit.unit}`}</span>
                  <span className="habit-track"><i style={{ width: `${completion(habit, value) * 100}%` }} /></span>
                </button>
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
              <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void addHabit()} placeholder="Например, прогулка" maxLength={80} />
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
            <button className="save-button" type="button" onClick={() => void addHabit()} disabled={savingHabit || !title.trim()}>{savingHabit ? 'Добавляем…' : 'Добавить привычку'}</button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
