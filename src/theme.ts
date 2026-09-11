export type Theme = 'light' | 'dark'

const THEME_KEY = 'habit-tracker:theme:v1'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (isTheme(saved)) return saved
  } catch {
    // Theme still works without storage.
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: Theme, persist = true): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (themeColor) themeColor.content = theme === 'dark' ? '#10130f' : '#f4f7f1'

  if (!persist) return
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Theme still applies when browser storage is unavailable.
  }
}
