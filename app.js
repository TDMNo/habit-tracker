// app.jsMore actionsMore actions

// ============================
// 📦 DOM-элементы
// ============================
const select = document.getElementById('user-select');
const input = document.getElementById('new-user');
const setUserBtn = document.getElementById('set-user');
const title = document.getElementById('username-title');
const dayHeaders = [
  document.getElementById('day1'),
  document.getElementById('day2'),
  document.getElementById('day3')
];
const table = document.getElementById('habit-table').querySelector('tbody');
const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');

// ============================
// 🔁 Состояние
// ============================
let userName = null;
let userData = null;
let offset = 0;

// ============================
// 🔧 Работа с датами
// ============================
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

// ============================
// 💾 Работа с localStorage
// ============================
function saveUserData() {
  localStorage.setItem('habit_' + userName, JSON.stringify(userData));
}

function loadUsers() {
  select.innerHTML = '';
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('habit_')) {
      const name = key.replace('habit_', '');
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
  });
}

function loadUserData(name) {
  const key = 'habit_' + name;
  const data = JSON.parse(localStorage.getItem(key)) || { name, habits: [], data: {} };
  return data;
}

// ============================
// 📋 Основной рендер таблицы
// ============================
function render() {
  if (!userData) return;

  // 📅 Получаем даты для отображения и анализа прогресса
  const visibleDays = getNDates(offset, 1);   // три дня: вчера, сегодня, завтра
  const progressDays = getNDates(offset, 3);  // семь дней для прогресса

  // 🗓 Обновляем заголовки таблицы (дата и день недели)
  dayHeaders.forEach((th, i) => {
    th.textContent = visibleDays[i].label;
    th.classList.toggle('current-day', visibleDays[i].isToday);
  });

  // 🧹 Очищаем таблицу перед перерисовкой
  table.innerHTML = '';

  // 🔁 Рисуем каждую привычку
  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // 🗑 Колонка удаления привычки
    const tdDel = document.createElement('td');
    tdDel.textContent = '🗑️';
    tdDel.style.cursor = 'pointer';
    tdDel.onclick = () => {
      userData.habits = userData.habits.filter(h => h !== habit);
      saveUserData();
      render();
    };
    tr.appendChild(tdDel);

    // 🏷 Название привычки
    const tdName = document.createElement('td');
    tdName.textContent = habit;
    tr.appendChild(tdName);

    // ⚪ Кружки — состояния по дням
    visibleDays.forEach(d => {
      const td = document.createElement('td');
      td.className = 'circle';

      const status = userData.data?.[d.key]?.[habit] || '';
      td.dataset.status = status;

      td.onclick = () => {
        const next = { '': 'done', 'done': 'fail', 'fail': '' }[status] || '';
        td.dataset.status = next;

        if (!userData.data[d.key]) userData.data[d.key] = {};
        if (next === '') delete userData.data[d.key][habit];
        else userData.data[d.key][habit] = next;

        saveUserData();
        render();
      };

      tr.appendChild(td);
    });

    // 📊 Прогресс-бар за 7 дней
    const tdBar = document.createElement('td');
    tdBar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';

    const completed = progressDays.filter(d => userData.data?.[d.key]?.[habit] === 'done').length;
    fill.style.width = `${(completed / progressDays.length) * 100}%`;

    tdBar.appendChild(fill);
    tr.appendChild(tdBar);

    // ➕ Добавляем строку в таблицу
    table.appendChild(tr);
  });
}

// ============================
// 🎯 Слушатели
// ============================

// Добавление участника
setUserBtn.onclick = () => {
  const name = input.value.trim();
  if (!name) return alert('Введите имя');

  const key = 'habit_' + name;

  // Если участника ещё нет — создаём
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ name, habits: [], data: {} }));
  }

  loadUsers();            // Перерисуем список
  select.value = name;    // Отметим пользователя
  setUser(name);          // Загрузим его данные

  input.value = '';       // Очистим поле ввода
};

// Добавление привычки
addBtn.onclick = () => {
  const habit = newHabitInput.value.trim();
  if (habit && userData && !userData.habits.includes(habit)) {
    userData.habits.push(habit);
    saveUserData();
    newHabitInput.value = '';
    render();
  }
};

// Переключение между участниками из списка
select.addEventListener('change', () => {
  const selectedName = select.value;
  if (selectedName) {
    setUser(selectedName);
  }
});


// 🗑 Удаление участника
const deleteUserBtn = document.getElementById('delete-user');
const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

deleteUserBtn.onclick = () => {
  if (!userName) return;

  // Показываем свою модалку
  confirmText.textContent = `Удалить участника "${userName}"?`;
  confirmModal.classList.remove('hidden');

  // Если нажали ОК
  confirmYes.onclick = () => {
    localStorage.removeItem('habit_' + userName);
    confirmModal.classList.add('hidden');
    loadUsers();

    if (select.options.length > 0) {
      const first = select.options[0].value;
      setUser(first);
      select.value = first;
    } else {
      userName = null;
      userData = null;
      title.textContent = 'Участник не выбран';
      table.innerHTML = '';
      addBtn.disabled = true;
      newHabitInput.disabled = true;
    }
  };

  // Если нажали Отмена
  confirmNo.onclick = () => {
    confirmModal.classList.add('hidden');
  };
};

// Ползунок
let swipeStartX = null;

function handleSwipeStart(e) {
  swipeStartX = e.touches ? e.touches[0].clientX : e.clientX;
}

function handleSwipeEnd(e) {
  if (swipeStartX === null) return;
  const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const diff = endX - swipeStartX;

  // минимальная длина свайпа
  if (Math.abs(diff) > 50) {
    if (diff < 0 && offset < 30) offset++;     // свайп влево
    if (diff > 0 && offset > -30) offset--;    // свайп вправо
    render();
  }

  swipeStartX = null;
}

// ============================
// 🚀 Старт
// ============================

window.onload = () => {
  loadUsers();

  setTimeout(() => {
    if (select.options.length > 0) {
      const firstUser = select.options[0].value;
      setUser(firstUser);          // Загружаем данные
      select.value = firstUser;    // Отмечаем в select
    } else {
      // Если никого нет — блокируем только кнопку привычки
      userName = null;
      userData = null;
      title.textContent = 'Участник не выбран';
      table.innerHTML = '';
      addBtn.disabled = true;
    }
  }, 50); // небольшая задержка в 50мс
  // 👉 Привязываем свайп к таблице
  const habitTableWrapper = document.getElementById('habit-table');
  habitTableWrapper.addEventListener('touchstart', handleSwipeStart);
  habitTableWrapper.addEventListener('touchend', handleSwipeEnd);
  habitTableWrapper.addEventListener('mousedown', handleSwipeStart);
  habitTableWrapper.addEventListener('mouseup', handleSwipeEnd);
};
};
