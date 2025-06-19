// app.js
// 📌 Главный скрипт — одна страница, два экрана: выбор и трекер

// ==============================
// 🔧 DOM-элементы
// ==============================

// 🔹 Элементы экрана выбора
const entryScreen = document.getElementById('entry-screen');
const select = document.getElementById('user-select');
const input = document.getElementById('new-user');
const button = document.getElementById('create-user');

// 🔹 Элементы экрана трекера
const trackerScreen = document.getElementById('tracker-screen');
const usernameTitle = document.getElementById('username');
const table = document.getElementById('habit-table')?.querySelector('tbody');
const dayHeaders = [
  document.getElementById('day1'),
  document.getElementById('day2'),
  document.getElementById('day3')
];
const rangeInput = document.getElementById('day-range');
const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');

// ==============================
// 🔁 Состояние приложения
// ==============================

let userData = null;
let userName = null;
let offset = 0;

// ==============================
// 👤 Работа с участниками
// ==============================

/**
 * 📦 Загрузка всех участников из localStorage
 */
function loadUsers() {
  select.innerHTML = '';
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('habit_')) {
      const name = key.replace('habit_', '');
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    }
  });
}

/**
 * 🧠 Получение данных участника из localStorage
 */
function loadUserData(name) {
  const key = 'habit_' + name;
  const data = JSON.parse(localStorage.getItem(key)) || { name, habits: [], data: {} };
  return data;
}

/**
 * 💾 Сохранение данных участника
 */
function saveUserData() {
  const key = 'habit_' + userName;
  localStorage.setItem(key, JSON.stringify(userData));
}

// ==============================
// 📅 Даты
// ==============================

function getNDates(centerOffset = 0, range = 1) {
  const base = new Date();
  base.setDate(base.getDate() + centerOffset);
  return Array.from({ length: range * 2 + 1 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i - range);
    return {
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      key: d.toISOString().split('T')[0],
      isToday: d.toDateString() === new Date().toDateString()
    };
  });
}

// ==============================
// 📋 Рендер трекера
// ==============================

function renderTracker() {
  const visibleDays = getNDates(offset, 1);
  const progressDays = getNDates(offset, 3);

  // 🔄 Заголовки дат
  visibleDays.forEach((d, i) => {
    const th = dayHeaders[i];
    th.textContent = d.label;
    th.classList.toggle('current-day', d.isToday);
  });

  // 🧹 Очистка таблицы
  table.innerHTML = '';

  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // 🗑 Удаление
    const tdDel = document.createElement('td');
    tdDel.className = 'delete-col';
    tdDel.innerHTML = '🗑️';
    tdDel.onclick = () => {
      userData.habits = userData.habits.filter(h => h !== habit);
      saveUserData();
      renderTracker();
    };
    tr.appendChild(tdDel);

    // 🏷 Название
    const tdName = document.createElement('td');
    tdName.className = 'name-col';
    tdName.textContent = habit;
    tr.appendChild(tdName);

    // 🔘 Круги по дням
    visibleDays.forEach(d => {
      const td = document.createElement('td');
      td.className = 'circle';
      const status = userData.data?.[d.key]?.[habit] || '';
      td.dataset.status = status;

      td.onclick = () => {
        const next = { '': 'done', 'done': 'fail', 'fail': '' }[td.dataset.status];
        td.dataset.status = next;

        if (!userData.data[d.key]) userData.data[d.key] = {};
        if (next === '') delete userData.data[d.key][habit];
        else userData.data[d.key][habit] = next;

        saveUserData();
        renderTracker();
      };

      tr.appendChild(td);
    });

    // 📊 Прогресс
    const tdBar = document.createElement('td');
    tdBar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';

    const completed = progressDays.filter(d => userData.data?.[d.key]?.[habit] === 'done').length;
    fill.style.width = `${(completed / progressDays.length) * 100}%`;

    tdBar.appendChild(fill);
    tr.appendChild(tdBar);
    table.appendChild(tr);
  });
}

// ==============================
// 🎯 Инициализация трекера
// ==============================

function initTracker(name) {
  userName = name;
  userData = loadUserData(name);

  usernameTitle.textContent = `Привычки: ${name}`;
  entryScreen.style.display = 'none';
  trackerScreen.style.display = 'block';
  renderTracker();
}

// ==============================
// 🔁 Слушатели
// ==============================

// 📌 Смещение по дням
rangeInput?.addEventListener('input', () => {
  offset = parseInt(rangeInput.value);
  renderTracker();
});

// ➕ Добавление новой привычки
addBtn?.addEventListener('click', () => {
  const habit = newHabitInput.value.trim();
  if (habit && !userData.habits.includes(habit)) {
    userData.habits.push(habit);
    saveUserData();
    newHabitInput.value = '';
    renderTracker();
  }
});

// 🚀 Кнопка "Перейти"
button?.addEventListener('click', () => {
  const name = input.value.trim() || select.value;
  if (!name) return alert('Введите имя или выберите участника');

  const key = 'habit_' + name;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ name, habits: [], data: {} }));
  }

  initTracker(name);
});

// ==============================
// ▶️ Старт
// ==============================

loadUsers();
