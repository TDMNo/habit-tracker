// 📍 URL твоего backend
const API_URL = 'https://script.google.com/macros/s/AKfycbzyP0P3udQn2VwqizpaZSOGDWW0uxxv2GjNXnO87ZpOpR5EEJ5thEZh4Oqw3DNxt7xk/exec';

// 🔄 Получить привычки для участника
async function getHabits(sheet) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'getHabits', sheet }),
    headers: { 'Content-Type': 'application/json' }
  });
  return await res.json();
}

// ✅ Переключить привычку
async function toggleHabit(sheet, row, col, value) {
  await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'toggleHabit', sheet, row, col, value
    }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// ➕ Добавить новую привычку
async function addHabit(sheet, name) {
  await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addHabit', sheet, name }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// 💡 Пример использования (можно удалить после подключения к UI)
(async () => {
  const habits = await getHabits('Лёня');
  console.log(habits);

  // Пример: переключаем ячейку
  await toggleHabit('Лёня', 2, 3, '✅');

  // Пример: добавляем привычку
  await addHabit('Лёня', 'Пить воду');
})();
