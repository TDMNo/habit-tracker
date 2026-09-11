import { useMemo, useState, type CSSProperties } from 'react'
import { daysAround, localDateKey, parseLocalDateKey } from './date'
import { loadState, saveState } from './storage'
import type { Habit, HabitType, TrackerState } from './types'

function completion(habit: Habit, value: number): number {
  if (habit.target <= 0) return 0
  return Math.min(Math.max(value, 0) / habit.target, 1)
}

function App() {
  const [state, setState] = useState<TrackerState>(loadState)
  const [selectedDate, setSelectedDate] = useState(localDateKey)
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<HabitType>('binary')

  const weekDays = useMemo(() => daysAround(selectedDate), [selectedDate])
  const selectedDateObject = useMemo(() => parseLocalDateKey(selectedDate), [selectedDate])
  const isToday = selectedDate === localDateKey()

  const valueFor = (habitId: string) => state.entries[selectedDate]?.[habitId]?.value ?? 0

  const progress = useMemo(() => {
    if (!state.habits.length) return 0
    const total = state.habits.reduce((sum, habit) => {
      const value = state.entries[selectedDate]?.[habit.id]?.value ?? 0
      return sum + completion(habit, value)
    }, 0)
    return Math.round((total / state.habits.length) * 100)
  }, [selectedDate, state])

  const updateState = (updater: (current: TrackerState) => TrackerState) => {
    setState((current) => {
      const next = updater(current)
      saveState(next)
      return next
    })
  }

  const setHabitValue = (habit: Habit, requestedValue: number) => {
    const value = Math.max(0, Math.min(requestedValue, habit.target))
    updateState((current) => {
      const entries = { ...current.entries }
      const dayEntries = { ...(entries[selectedDate] ?? {}) }

      if (value === 0) {
        delete dayEntries[habit.id]
      } else {
        dayEntries[habit.id] = {
          habitId: habit.id,
          date: selectedDate,
          value,
          updatedAt: new Date().toISOString(),
        }
      }

      if (Object.keys(dayEntries).length === 0) delete entries[selectedDate]
      else entries[selectedDate] = dayEntries

      return { ...current, entries }
    })
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
      createdAt: new Date().toISOString(),
      ...defaults,
    }

    updateState((current) => ({ ...current, habits: [...current.habits, habit] }))
    setTitle('')
    setType('binary')
    setIsAdding(false)
  }

  const completedCount = state.habits.filter((habit) => completion(habit, valueFor(habit.id)) === 1).length

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow-row">
            <p className="eyebrow">{isToday ? 'Сегодня' : selectedDateObject.toLocaleDateString('ru-RU', { weekday: 'long' })}</p>
            {!isToday && <button className="today-link" type="button" onClick={() => setSelectedDate(localDateKey())}>К сегодня</button>}
          </div>
          <h1>{selectedDateObject.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h1>
        </div>
        <div className="avatar" aria-hidden="true">К</div>
      </header>

      <section className="week-strip" aria-label="Выбор дня">
        {weekDays.map((item) => {
          const active = item.key === selectedDate
          const className = `day${active ? ' active' : ''}${item.isToday && !active ? ' today' : ''}`
          return (
            <button className={className} key={item.key} type="button" onClick={() => setSelectedDate(item.key)} aria-current={active ? 'date' : undefined}>
              <span>{item.day}</span>
              <strong>{item.date}</strong>
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
          <h2>{progress === 100 ? 'День закрыт!' : progress >= 50 ? 'Отличный темп' : 'Начнём с малого'}</h2>
          <span>{completedCount} из {state.habits.length} привычек выполнено</span>
        </div>
      </section>

      <section className="habit-section">
        <div className="section-heading">
          <h2>Мои привычки</h2>
          <span>{state.habits.length}</span>
        </div>
        <div className="habit-list">
          {state.habits.map((habit) => {
            const value = valueFor(habit.id)
            const done = completion(habit, value) === 1
            return (
              <article className={`habit-card ${habit.color} ${done ? 'done' : ''}`} key={habit.id}>
                <div className="habit-icon" aria-hidden="true">{habit.emoji}</div>
                <button className="habit-main" type="button" onClick={() => advanceHabit(habit)}>
                  <span className="habit-title">{habit.title}</span>
                  <span className="habit-value">
                    {habit.type === 'binary' ? (done ? 'Выполнено' : 'Отметить') : `${value} / ${habit.target} ${habit.unit}`}
                  </span>
                  <span className="habit-track"><i style={{ width: `${completion(habit, value) * 100}%` }} /></span>
                </button>
                {habit.type === 'binary' ? (
                  <button className="check-button" type="button" onClick={() => advanceHabit(habit)} aria-label={done ? `Отменить выполнение: ${habit.title}` : `Выполнить: ${habit.title}`}>
                    {done ? '✓' : ''}
                  </button>
                ) : (
                  <div className="stepper">
                    <button type="button" onClick={() => decreaseHabit(habit)} aria-label={`Уменьшить: ${habit.title}`}>−</button>
                    <button type="button" onClick={() => advanceHabit(habit)} aria-label={`Увеличить: ${habit.title}`}>+</button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <button className="add-button" type="button" onClick={() => setIsAdding(true)}><span>+</span> Новая привычка</button>

      {isAdding && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={() => setIsAdding(false)}>
          <section className="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2 id="add-title">Новая привычка</h2>
            <label>
              Название
              <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addHabit()} placeholder="Например, прогулка" maxLength={50} />
            </label>
            <fieldset>
              <legend>Как будем считать?</legend>
              <div className="type-grid">
                {([
                  ['binary', '✓', 'Да / нет'],
                  ['count', '#', 'Количество'],
                  ['duration', '◷', 'Время'],
                ] as const).map(([value, icon, label]) => (
                  <button className={type === value ? 'selected' : ''} key={value} type="button" onClick={() => setType(value)}>
                    <strong>{icon}</strong><span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="save-button" type="button" onClick={addHabit} disabled={!title.trim()}>Добавить привычку</button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
