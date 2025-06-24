// app.jsMore actions

// ============================
// 📦 DOM-элементы
// ============================
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

  const visibleDays = getNDates(offset, 1);
  const progressDays = getNDates(offset, 3);

  dayHeaders.forEach((th, i) => {
    th.textContent = visibleDays[i].label;
    th.classList.toggle('current-day', visibleDays[i].isToday);
  });

  table.innerHTML = '';

  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    const tdDel = document.createElement('td');
    tdDel.textContent = '🗑️';
    tdDel.style.cursor = 'pointer';
    tdDel.onclick = () => {
      userData.habits = userData.habits.filter(h => h !== habit);
      saveUserData();
      render();
    };
    tr.appendChild(tdDel);

    const tdName = document.createElement('td');
    tdName.textContent = habit;
    tr.appendChild(tdName);

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
setUserBtn.onclick = () => {
  const name = input.value.trim();
  if (!name) return alert('Введите имя');

  const key = 'habit_' + name;

  // Если участника ещё нет — создаём
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ name, habits: [], data: {} }));
  }

  loadUsers(); // Перерисуем список

  // Отложим выбор участника на 100мс, чтобы успел перерисоваться select
  setTimeout(() => {
    select.value = name;
    setUser(name);
  }, 100);

  input.value = '';
};



// 🗑 Удаление участника
const deleteUserBtn = document.getElementById('delete-user');
const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

deleteUserBtn.onclick = () => {
  if (!userName) return;
  
const confirmDelete = confirm(`Удалить участника "${userName}"? Это действие необратимо.`);
if (!confirmDelete) return;
  
  confirmText.textContent = `Удалить участника "${userName}"?`;
  confirmModal.classList.remove('hidden');

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

  localStorage.removeItem('habit_' + userName);
  confirmNo.onclick = () => {
    confirmModal.classList.add('hidden');
  };
};

 

// ============================
// 🚀 Старт
// ============================

window.onload = () => {
  loadUsers();

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
};
