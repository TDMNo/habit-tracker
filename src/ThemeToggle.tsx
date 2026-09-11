import { useState } from 'react'
import { applyTheme, getInitialTheme, type Theme } from './theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  const toggleTheme = () => {
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  )
}
