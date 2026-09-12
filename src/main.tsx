import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeToggle } from './ThemeToggle'
import { applyTheme, getInitialTheme } from './theme'
import './styles.css'
import './auth.css'
import './theme.css'
import './final-mobile.css'

applyTheme(getInitialTheme(), false)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemeToggle />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
