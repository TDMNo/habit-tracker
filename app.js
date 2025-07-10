// ============================
// 📦 DOM-элементы
// ============================
let isDragging = false;
let dragStartX = 0;
let lastDelta = 0;
let hasScrolled = false;

const select = document.getElementById('user-select');
const input = document.getElementById('new-user');
const setUserBtn = document.getElementById('set-user');
const title = document.getElementById('username-title');
const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');
let table;

window.addEventListener('DOMContentLoaded', () => {
  table = document.getElementById('habit-table')?.querySelector('tbody');
});

// ============================
// 🔁 Состояние
// ============================
let userName = null;
let userData = null;
let allDates = getAllDates();
let slideOffset = 31;

// ============================
// 🔧 Работа с датами
// ============================
function getAllDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];

  for (let i = -31; i <= 32; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push({
      label: d.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      }),
      key: d.toISOString().split('T')[0],
      isToday: d.toDateString() === new Date().toDateString(),
      date: d
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
  return JSON.parse(localStorage.getItem(key)) || { name, habits: [], data: {} };
}

// ============================
// 📋 Основной рендер таблицы
// ============================
function render() {
  if (!userData) return;

  const tbody = document.getElementById('habit-table')?.querySelector('tbody');
  if (!tbody) return;

  const visibleDays = allDates.slice(slideOffset - 1, slideOffset + 2);

  const th1 = document.getElementById('date-th-1');
  const th2 = document.getElementById('date-th-2');
  const th3 = document.getElementById('date-th-3');

  if (th1 && th2 && th3) {
    th1.textContent = visibleDays[0]?.label || '';
    th2.textContent = visibleDays[1]?.label || '';
    th3.textContent = visibleDays[2]?.label || '';
  }

  tbody.innerHTML = '';

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

    allDates.forEach((d, i) => {
      const td = document.createElement('td');
      td.className = 'circle';
      td.dataset.index = i;
      td.style.display = (i >= slideOffset - 1 && i <= slideOffset + 1) ? '' : 'none';

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

      td.addEventListener('mousedown', e => {
        isDragging = true;
        dragStartX = e.clientX;
        lastDelta = 0;
        hasScrolled = false;
      });

      td.addEventListener('touchstart', e => {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        hasScrolled = false;
      });

      td.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const delta = e.touches[0].clientX - dragStartX;
        if (hasScrolled) return;
        if (Math.abs(delta) > 30) {
          if (delta < 0 && slideOffset < allDates.length - 2) {
            slideOffset += 1;
          } else if (delta > 0 && slideOffset > 1) {
            slideOffset -= 1;
          }
          hasScrolled = true;
          render();
        }
      });

      td.addEventListener('touchend', () => {
        isDragging = false;
        hasScrolled = false;
      });

      tr.appendChild(td);
    });

    const progressDays = allDates.slice(slideOffset - 3, slideOffset + 4);
    const tdBar = document.createElement('td');
    tdBar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';

    const completed = progressDays.filter(d => userData.data?.[d.key]?.[habit] === 'done').length;
    fill.style.width = `${(completed / progressDays.length) * 100}%`;

    tdBar.appendChild(fill);
    tr.appendChild(tdBar);
    tbody.appendChild(tr);
  });
}

// ============================
// 🎮 Drag-свайп мышкой
// ============================
document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const delta = e.clientX - dragStartX;
  if (hasScrolled) return;
  if (Math.abs(delta) > 30) {
    if (delta < 0 && slideOffset < allDates.length - 2) {
      slideOffset += 1;
    } else if (delta > 0 && slideOffset > 1) {
      slideOffset -= 1;
    }
    hasScrolled = true;
    render();
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  hasScrolled = false;
});

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
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ name, habits: [], data: {} }));
  }
  loadUsers();
  select.value = name;
  setUser(name);
  input.value = '';
};

addBtn.onclick = () => {
  const habit = newHabitInput.value.trim();
  if (habit && userData && !userData.habits.includes(habit)) {
    userData.habits.push(habit);
    saveUserData();
    newHabitInput.value = '';
    render();
  }
};

select.addEventListener('change', () => {
  const selectedName = select.value;
  if (selectedName) {
    setUser(selectedName);
  }
});

const deleteUserBtn = document.getElementById('delete-user');
const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

deleteUserBtn.onclick = () => {
  if (!userName) return;
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
      render();
      addBtn.disabled = true;
      newHabitInput.disabled = true;
    }
  };

  confirmNo.onclick = () => {
    confirmModal.classList.add('hidden');
  };
};

// ============================
// 🚀 При загрузке страницы
// ============================
window.onload = () => {
  loadUsers();
  setTimeout(() => {
    if (select.options.length > 0) {
      const firstUser = select.options[0].value;
      setUser(firstUser);
      select.value = firstUser;
    } else {
      userName = null;
      userData = null;
      title.textContent = 'Участник не выбран';
      addBtn.disabled = true;
      newHabitInput.disabled = true;
      render();
    }
  }, 50);
};
