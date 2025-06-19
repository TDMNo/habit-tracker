// app.js
// 📌 Главный скрипт, обслуживает как index.html, так и user.html

// ================================
// 🔁 1. Определение страницы
// ================================
const path = window.location.pathname;
if (path.endsWith('index.html') || path.endsWith('/')) initIndexPage();
else if (path.endsWith('user.html')) initUserPage();

// ================================
// 👤 2. Страница index.html
// ================================
function initIndexPage() {
  const select = document.getElementById('user-select');
  const input = document.getElementById('new-user');
  const button = document.getElementById('create-user');

  /**
   * 📦 Загрузка существующих пользователей из localStorage
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
   * 🚀 Переход к user.html по выбранному имени
   */
  select.addEventListener('change', () => {
    if (select.value) {
      window.location.href = `user.html?name=${encodeURIComponent(select.value)}`;
    }
  });

  /**
   * ➕ Создание нового пользователя
   */
  button.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) return alert('Введите имя');
    const key = 'habit_' + name;
    if (!localStorage.getItem(key)) {
      const newUser = { name, habits: [], data: {} };
      localStorage.setItem(key, JSON.stringify(newUser));
    }
    window.location.href = `user.html?name=${encodeURIComponent(name)}`;
  });

  loadUsers();
}

// ================================
// 📋 3. Страница user.html
// ================================
function initUserPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const userName = urlParams.get('name');
  if (!userName) return (location.href = 'index.html');

  const title = document.getElementById('username');
  const table = document.getElementById('habit-table').querySelector('tbody');
  const dayHeaders = [
    document.getElementById('day1'),
    document.getElementById('day2'),
    document.getElementById('day3')
  ];
  const addBtn = document.getElementById('add-btn');
  const newHabitInput = document.getElementById('new-habit');
  const rangeInput = document.getElementById('day-range');

  title.textContent = `Привычки:  ${userName}`;
  const storageKey = 'habit_' + userName;
  let userData = JSON.parse(localStorage.getItem(storageKey)) || { name: userName, habits: [], data: {} };

  let offset = 0;
  rangeInput.addEventListener('input', () => {
    offset = parseInt(rangeInput.value);
    render();
  });

  /**
   * 📅 Получение диапазона дат (3 для таблицы, 7 для прогресса)
   */
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

  /**
   * 💾 Сохранение данных
   */
  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(userData));
  }

  /**
   * 🔄 Основной рендер интерфейса
   */
  function render() {
    const visibleDays = getNDates(offset, 1);   // 3 дня: -1, 0, +1
    const progressDays = getNDates(offset, 3);  // 7 дней: -3 ... +3

    // 🎯 Обновление заголовков
    visibleDays.forEach((d, i) => {
      const th = dayHeaders[i];
      th.textContent = d.label;
      th.classList.toggle('current-day', d.isToday);
    });

    // 🧹 Очистка таблицы
    table.innerHTML = '';

    // 🔁 По каждой привычке:
    userData.habits.forEach(habit => {
      const tr = document.createElement('tr');

      // 🗑️ Удаление
      const tdDel = document.createElement('td');
      tdDel.className = 'delete-col';
      tdDel.innerHTML = '🗑️';
      tdDel.style.cursor = 'pointer';
      tdDel.onclick = () => {
        userData.habits = userData.habits.filter(h => h !== habit);
        saveData();
        render();
      };
      tr.appendChild(tdDel);

      // 🏷 Название привычки
      const tdName = document.createElement('td');
      tdName.className = 'name-col';
      tdName.textContent = habit;
      tr.appendChild(tdName);

      // 🔘 Ячейки по датам
      visibleDays.forEach(d => {
        const td = document.createElement('td');
        td.className = 'circle';
        const status = userData.data?.[d.key]?.[habit] || '';
        td.dataset.status = status;
        td.onclick = () => {
          const map = { '': 'done', 'done': 'fail', 'fail': '' };
          const next = map[td.dataset.status];
          td.dataset.status = next;

          if (!userData.data[d.key]) userData.data[d.key] = {};
          if (next === '') delete userData.data[d.key][habit];
          else userData.data[d.key][habit] = next;

          saveData();
          render();
        };
        tr.appendChild(td);
      });

      // 📊 Прогресс-бар
      let completed = 0;
      progressDays.forEach(d => {
        if (userData.data?.[d.key]?.[habit] === 'done') completed++;
      });
      const progress = (completed / progressDays.length) * 100;

      const tdBar = document.createElement('td');
      tdBar.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${progress}%`;
      tdBar.appendChild(fill);
      tr.appendChild(tdBar);

      table.appendChild(tr);
    });
  }

  // ➕ Добавление новой привычки
  addBtn.onclick = () => {
    const habit = newHabitInput.value.trim();
    if (habit && !userData.habits.includes(habit)) {
      userData.habits.push(habit);
      saveData();
      render();
      newHabitInput.value = '';
    }
  };

  render(); // 🚀 Старт
}
