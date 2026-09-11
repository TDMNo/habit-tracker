import { useState, type FormEvent } from 'react'

interface LoginScreenProps {
  unavailable?: boolean
  onLogin: (login: string, password: string) => Promise<void>
}

export function LoginScreen({ unavailable = false, onLogin }: LoginScreenProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!login.trim() || !password) return
    setSubmitting(true)
    setError('')
    try {
      await onLogin(login, password)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ''
      setError(message === 'invalid_credentials' ? 'Неверный логин или пароль' : 'Не удалось войти. Проверь соединение.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-mark" aria-hidden="true">✓</div>
        <p className="eyebrow">Habit Tracker</p>
        <h1>С возвращением</h1>
        <p className="login-copy">Твои привычки и прогресс синхронизируются между устройствами.</p>

        {unavailable && <p className="login-warning">Сервер сейчас недоступен. Для входа нужна сеть.</p>}
        {error && <p className="login-error" role="alert">{error}</p>}

        <form onSubmit={submit}>
          <label>
            Логин
            <input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} maxLength={64} />
          </label>
          <label>
            Пароль
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={256} />
          </label>
          <button className="login-button" type="submit" disabled={submitting || !login.trim() || !password}>
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </section>
    </main>
  )
}
