import { useMemo, useState, type CSSProperties } from 'react'
import { loadHabits, saveHabits } from './storage'
import type { Habit, HabitType } from './types'

const weekDays = Array.from({ length: 7 }, (_, offset) => {
  const date = new Date()
  date.setDate(date.getDate() - 3 + offset)
  return {
    key: date.toISOString().slice(0, 10),
    day: date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''),
    date: date.getDate(),
    isToday: offset === 3,
  }
})

function completion(habit: Habit): number {
  return Math.min(habit.value / habit.target, 1)
}

function App() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits)
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<HabitType>('binary')

  const progress = useMemo(() => {
    if (!habits.length) return 0
    const total = habits.reduce((sum, habit) => sum + completion(habit), 0)
    return Math.round((total / habits.length) * 100)
  }, [habits])

  const updateHabits = (next: Habit[]) => {
    setHabits(next)
    saveHabits(next)
  }

  const advanceHabit = (habit: Habit) => {
    const step = habit.type === 'duration' ? 5 : 1
    const value = habit.type === 'binary' && habit.value >= 1 ? 0 : Math.min(habit.value + step, habit.target)
    updateHabits(habits.map((item) => (item.id === habit.id ? { ...item, value } : item)))
  }

  const decreaseHabit = (habit: Habit) => {
    const step = habit.type === 'duration' ? 5 : 1
    updateHabits(habits.map((item) => (item.id === habit.id ? { ...item, value: Math.max(0, item.value - step) } : item)))
  }

  const addHabit = () => {
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    const defaults = type === 'duration'
      ? { target: 30, unit: 'мин' }
      : type === 'count'
        ? { target: 10, unit: 'раз' }
        : { target: 1, unit: '' }

    updateHabits([...habits, {
      id: crypto.randomUUID(),
      title: cleanTitle,
      emoji: type === 'duration' ? '⏱️' : type === 'count' ? '🎯' : '✨',
      type,
      value: 0,
      color: 'lime',
      ...defaults,
    }])
    setTitle('')
    setType('binary')
    setIsAdding(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Сегодня</p>
          <h1>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h1>
        </div>
        <div className="avatar" aria-hidden="true">К</div>
      </header>

      <section className="week-strip" aria-label="Дни недели">
        {weekDays.map((item) => (
          <div className={item.isToday ? 'day active' : 'day'} key={item.key} aria-current={item.isToday ? 'date' : undefined}>
            <span>{item.day}</span>
            <strong>{item.date}</strong>
          </div>
        ))}
      </section>

      <section className="summary-card" aria-label={`Прогресс дня ${progress}%`}>
        <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}>
          <div><strong>{progress}%</strong><span>готово</span></div>
        </div>
        <div className="summary-copy">
          <p>Прогресс дня</p>
          <h2>{progress === 100 ? 'День закрыт!' : progress >= 50 ? 'Отличный темп' : 'Начнём с малого'}</h2>
          <span>{habits.filter((habit) => completion(habit) === 1).length} из {habits.length} привычек выполнено</span>
        </div>
      </section>

      <section className="habit-section">
        <div className="section-heading">
          <h2>Мои привычки</h2>
          <span>{habits.length}</span>
        </div>
        <div className="habit-list">
          {habits.map((habit) => {
            const done = completion(habit) === 1
            return (
              <article className={`habit-card ${habit.color} ${done ? 'done' : ''}`} key={habit.id}>
                <div className="habit-icon" aria-hidden="true">{habit.emoji}</div>
                <button className="habit-main" type="button" onClick={() => advanceHabit(habit)}>
                  <span className="habit-title">{habit.title}</span>
                  <span className="habit-value">
                    {habit.type === 'binary' ? (done ? 'Выполнено' : 'Отметить') : `${habit.value} / ${habit.target} ${habit.unit}`}
                  </span>
                  <span className="habit-track"><i style={{ width: `${completion(habit) * 100}%` }} /></span>
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
