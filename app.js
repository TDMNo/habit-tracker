// app.jsMore actionsMore actions

// ============================
// 📦 DOM-элементы
// ============================More actions
const select = document.getElementById('user-select');
const input = document.getElementById('new-user');
const setUserBtn = document.getElementById('set-user');
const title = document.getElementById('username-title');
const rangeInput = document.getElementById('day-range');
const dayHeaders = [
  document.getElementById('day1'),
  document.getElementById('day2'),
  document.getElementById('day3')
];
let table;

window.addEventListener('DOMContentLoaded', () => {
  table = document.getElementById('habit-table')?.querySelector('tbody');
});

const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');

// ============================
// 🔁 Состояние
// ============================
let userName = null;
let userData = null;
let offset = 0;

let allDates = getAllDates();   // ✅ Массив всех 64 дат
let slideOffset = 31;           // ✅ Индекс "сегодня" (центр массива)

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
// ✅ Новый массив дат — на 64 дня (от -31 до +32 от сегодня)
function getAllDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // обнуляем время — для точного сравнения с today
  const dates = [];

  for (let i = -31; i <= 32; i++) {
    const d = new Date(today);        // создаём копию текущей даты
    d.setDate(today.getDate() + i);   // сдвигаем на нужное число дней
    dates.push({
      label: d.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      }),
      key: d.toISOString().split('T')[0],      // строка вида "2025-07-10"
      isToday: d.toDateString() === new Date().toDateString(),
      date: d                                   // дата как объект — пригодится для сортировки
    });
  }

  return dates;
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

  // 🔍 Ищем tbody каждый раз, когда вызываем render
  const tbody = document.getElementById('habit-table')?.querySelector('tbody');
  if (!tbody) return;

  // 1. Получаем 3 даты: вчера / сегодня / завтра
  const visibleDays = allDates.slice(slideOffset - 1, slideOffset + 2);

  // 2. Обновляем заголовки таблицы
  dayHeaders.forEach((th, i) => {
    const d = visibleDays[i];
    if (d) {
      th.textContent = d.label;
      th.classList.toggle('current-day', d.isToday);
    }
  });

  // 3. Очищаем таблицу
  tbody.innerHTML = '';

  // 4. Для каждой привычки создаём строку
  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // 🗑 Кнопка удаления привычки
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

    // 🔘 Статусы по 3 датам
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

    // 📊 Прогресс-бар
    const progressDays = allDates.slice(slideOffset - 3, slideOffset + 4);
    const tdBar = document.createElement('td');
    tdBar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';

    const completed = progressDays.filter(d => userData.data?.[d.key]?.[habit] === 'done').length;
    fill.style.width = `${(completed / progressDays.length) * 100}%`;

    tdBar.appendChild(fill);
    tr.appendChild(tdBar);

    // ⬇️ Добавляем в таблицу
    tbody.appendChild(tr);
  });
}


// ============================
// ⚙️ Установить участника
// ============================
function setUser(name) {
  userName = name;
 const key = 'habit_' + name;
if (!localStorage.getItem(key)) {
  localStorage.setItem(key, JSON.stringify({ name, habits: [], data: {} }));
}
userData = loadUserData(name);
  title.textContent = `Привычки: ${name}`;
  saveUserData();
  render();
   addBtn.disabled = false;
  newHabitInput.disabled = false;
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
      render();
      addBtn.disabled = true;
      newHabitInput.disabled = true;
    }
  };

  // Если нажали Отмена
  confirmNo.onclick = () => {
    confirmModal.classList.add('hidden');
  };
};




// ============================
// 🚀 Старт при загрузке страницы
// ============================
window.onload = () => {
  loadUsers();

  setTimeout(() => {
    if (select.options.length > 0) {
      const firstUser = select.options[0].value;
      setUser(firstUser);
      select.value = firstUser;

      // Ждём, пока DOM отрендерится
      setTimeout(() => {
        const slider = document.getElementById('day-slider');
        if (!slider) return;

        let startX = 0;

        // 👆 Слушаем свайп влево/вправо
        slider.addEventListener('touchstart', e => {
          startX = e.touches[0].clientX;
        });

        slider.addEventListener('touchend', e => {
          const deltaX = e.changedTouches[0].clientX - startX;

          if (Math.abs(deltaX) > 30) {
            if (deltaX < 0 && slideOffset < allDates.length - 2) {
              slideOffset += 1;
            } else if (deltaX > 0 && slideOffset > 1) {
              slideOffset -= 1;
            }
            render();
          }
        });

        // 📌 Центруем "сегодня"
        const center = document.getElementById('day2');
        if (center) {
          center.scrollIntoView({
            behavior: 'instant',
            inline: 'center',
            block: 'nearest'
          });
        }
      }, 100); // конец внутреннего setTimeout
    }

    // 👇 ЭТО ELSE — на том же уровне, что if (select.options.length > 0)
    else {
  userName = null;
  userData = null;
  title.textContent = 'Участник не выбран';
  addBtn.disabled = true;
  newHabitInput.disabled = true;
  render(); // ✅ корректно очищает таблицу сам
}

  }, 50); // конец внешнего setTimeout
};
