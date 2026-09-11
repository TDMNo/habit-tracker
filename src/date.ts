export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function shiftDateKey(key: string, days: number): string {
  const date = parseLocalDateKey(key)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function daysAround(centerKey: string, radius = 3) {
  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const key = shiftDateKey(centerKey, index - radius)
    const date = parseLocalDateKey(key)
    return {
      key,
      day: date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''),
      date: date.getDate(),
      isToday: key === localDateKey(),
    }
  })
}
