// ============================
// 📱 PWA функциональность
// ============================
let deferredPrompt;
const installPrompt = document.getElementById('install-prompt');

// Обработчик события beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Показываем кнопку установки, если приложение еще не установлено
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    installPrompt.classList.add('show');
  }
});

// Клик по кнопке установки
installPrompt.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('PWA установлен');
  }
  
  deferredPrompt = null;
  installPrompt.classList.remove('show');
});

// Скрываем кнопку если приложение уже установлено
window.addEventListener('appinstalled', () => {
  installPrompt.classList.remove('show');
  console.log('PWA успешно установлен');
});

// Регистрация Service Worker для офлайн работы
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Создаем Service Worker inline для Claude artifacts
    const swCode = `
      const CACHE_NAME = 'habit-tracker-v1';
      const urlsToCache = [
        '/',
        '/index.html'
      ];

      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
        );
      });

      self.addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request)
            .then((response) => {
              if (response) {
                return response;
              }
              return fetch(event.request);
            })
        );
      });
    `;
    
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('Service Worker зарегистрирован:', registration);
      })
      .catch((error) => {
        console.log('Ошибка регистрации Service Worker:', error);
      });
  });
}

// Улучшенная работа с localStorage для PWA
function saveUserData() {
  try {
    if (typeof Storage !== 'undefined') {
      localStorage.setItem('habit_' + userName, JSON.stringify(userData));
    }
  } catch (e) {
    console.warn('LocalStorage недоступен:', e);
  }
}

function loadUsers() {
  select.innerHTML = '';
  
  try {
    if (typeof Storage !== 'undefined') {
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
  } catch (e) {
    console.warn('Ошибка загрузки пользователей:', e);
  }
  
  // Если нет пользователей в localStorage, добавляем тестовых
  if (select.options.length === 0) {
    const testUsers = ['Иван', 'Мария', 'Алексей'];
    testUsers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }
}

function loadUserData(name) {
  try {
    if (typeof Storage !== 'undefined') {
      const key = 'habit_' + name;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (e) {
    console.warn('Ошибка загрузки данных пользователя:', e);
  }
  
  // Тестовые данные как fallback
  const testData = {
    'Иван': {
      name: 'Иван',
      habits: ['Зарядка', 'Чтение книг', 'Медитация'],
      data: {}
    },
    'Мария': {
      name: 'Мария', 
      habits: ['Йога', 'Изучение английского языка', 'Прогулка'],
      data: {}
    },
    'Алексей': {
      name: 'Алексей',
      habits: ['Бег', 'Программирование', 'Здоровое питание', 'Очень длинная привычка с большим количеством символов для тестирования'],
      data: {}
    }
  };
  
  return testData[name] || { name, habits: [], data: {} };
}

// Предотвращение случайного обновления страницы
window.addEventListener('beforeunload', (e) => {
  // Сохраняем данные перед закрытием
  if (userData && userName) {
    saveUserData();
  }
});

// ============================
// 📦 DOM-элементы
// ============================
let isDragging = false;
let dragStartX = 0;
let slideStartOffset = 0;
let lastStep = 0;

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
// 📊 Функции статистики
// ============================
function getCurrentMonth() {
  const centerDate = allDates[slideOffset];
  if (!centerDate) return null;
  
  const date = centerDate.date;
  return {
    year: date.getFullYear(),
    month: date.getMonth(), // 0-11
    monthName: date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthProgress(habit, year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  let completedDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = date.toISOString().split('T')[0];
    
    if (userData.data?.[dateKey]?.[habit] === 'done') {
      completedDays++;
    }
  }
  
  return {
    completed: completedDays,
    total: daysInMonth,
    percentage: Math.round((completedDays / daysInMonth) * 100)
  };
}

function updateProgressBars() {
  if (!userData) return;
  
  const currentMonth = getCurrentMonth();
  if (!currentMonth) return;
  
  // Обновляем заголовок колонки прогресса
  const progressHeader = document.querySelector('.progress-col');
  if (progressHeader && progressHeader.tagName === 'TH') {
    progressHeader.textContent = `Прогресс (${currentMonth.monthName.split(' ')[0]})`;
  }
}

function generateAvailableMonths() {
  const months = new Set();
  
  if (!userData || !userData.data) return [];
  
  // Собираем все месяцы из данных пользователя
  Object.keys(userData.data).forEach(dateKey => {
    const date = new Date(dateKey);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    months.add(JSON.stringify({ key: monthKey, name: monthName, year: date.getFullYear(), month: date.getMonth() }));
  });
  
  // Добавляем текущий месяц, если данных нет
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const currentMonthName = today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  months.add(JSON.stringify({ key: currentMonthKey, name: currentMonthName, year: today.getFullYear(), month: today.getMonth() }));
  
  return Array.from(months).map(m => JSON.parse(m)).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

// ============================
// 💾 Работа с localStorage (теперь с PWA поддержкой)
// ============================
// Функции saveUserData, loadUsers, loadUserData уже определены выше в PWA секции

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
    
    // Подсветка текущего дня
    [th1, th2, th3].forEach((th, i) => {
      th.classList.toggle('current-day', visibleDays[i]?.isToday || false);
    });
  }

  tbody.innerHTML = '';

  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // Колонка удаления
    const tdDel = document.createElement('td');
    tdDel.innerHTML = '<span class="delete-habit">🗑️</span>';
    tdDel.onclick = () => {
      userData.habits = userData.habits.filter(h => h !== habit);
      saveUserData();
      render();
    };
    tr.appendChild(tdDel);

    // Колонка названия привычки с переносом
    const tdName = document.createElement('td');
    tdName.className = 'name-col';
    const habitDiv = document.createElement('div');
    habitDiv.className = 'habit-name';
    habitDiv.textContent = habit;
    tdName.appendChild(habitDiv);
    tr.appendChild(tdName);

    // Колонки с кружками для каждого дня
    allDates.forEach((d, i) => {
      const td = document.createElement('td');
      td.style.display = (i >= slideOffset - 1 && i <= slideOffset + 1) ? '' : 'none';
      
      // Подсветка текущего дня
      if (d.isToday && i >= slideOffset - 1 && i <= slideOffset + 1) {
        td.classList.add('current-day');
      }

      const circleContainer = document.createElement('div');
      circleContainer.className = 'circle-container';
      
      const circle = document.createElement('div');
      circle.className = 'circle';
      circle.dataset.index = i;

      const status = userData.data?.[d.key]?.[habit] || '';
      circle.dataset.status = status;

      // Клик по кружку для изменения статуса
      circle.onclick = (e) => {
        e.stopPropagation();
        const next = { '': 'done', 'done': 'fail', 'fail': '' }[status] || '';
        circle.dataset.status = next;

        if (!userData.data[d.key]) userData.data[d.key] = {};
        if (next === '') delete userData.data[d.key][habit];
        else userData.data[d.key][habit] = next;

        saveUserData();
        render();
      };

      // Обработчики для свайпа
      circle.addEventListener('mousedown', e => {
        e.preventDefault();
        isDragging = true;
        dragStartX = e.clientX;
        slideStartOffset = slideOffset;
        lastStep = 0;
      });

      circle.addEventListener('touchstart', e => {
        e.preventDefault();
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        slideStartOffset = slideOffset;
        lastStep = 0;
      }, { passive: false });

      circleContainer.appendChild(circle);
      td.appendChild(circleContainer);
      tr.appendChild(td);
    });

    // Колонка прогресса
    const currentMonth = getCurrentMonth();
    const tdBar = document.createElement('td');
    tdBar.className = 'progress-col';
    
    if (currentMonth) {
      const progress = getMonthProgress(habit, currentMonth.year, currentMonth.month);
      
      const progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${progress.percentage}%`;

      const progressText = document.createElement('div');
      progressText.className = 'progress-text';
      progressText.textContent = `${progress.completed}/${progress.total}`;

      progressBar.appendChild(fill);
      tdBar.appendChild(progressBar);
      tdBar.appendChild(progressText);
    }
    
    tr.appendChild(tdBar);
    tbody.appendChild(tr);
  });
  
  // Обновляем заголовок прогресса
  updateProgressBars();
}

// ============================
// 🎮 Drag-свайп
// ============================
function handleDrag(clientX) {
  if (!isDragging) return;
  const delta = clientX - dragStartX;
  const stepSize = 60; // Уменьшили чувствительность для лучшего контроля
  const step = Math.round(delta / stepSize);

  if (step !== lastStep) {
    let newOffset = slideStartOffset - step;
    newOffset = Math.max(1, Math.min(allDates.length - 2, newOffset));
    slideOffset = newOffset;
    lastStep = step;
    render();
  }
}

// Только для десктопа
document.addEventListener('mousemove', e => {
  if ('ontouchstart' in window) return; // Отключаем на touch устройствах
  handleDrag(e.clientX);
});

document.addEventListener('mouseup', () => {
  if ('ontouchstart' in window) return; // Отключаем на touch устройствах
  isDragging = false;
});

// Отключаем глобальные touch обработчики (они теперь локальные на кружках)
// document.addEventListener('touchmove', e => {
//   if (isDragging) {
//     e.preventDefault();
//     handleDrag(e.touches[0].clientX);
//   }
// }, { passive: false });

// document.addEventListener('touchend', () => {
//   isDragging = false;
// });

// ============================
// ⚙️ Установить участника
// ============================
function setUser(name) {
  userName = name;
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
  
  // Добавляем нового пользователя в select
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  select.appendChild(opt);
  
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

// Обработка Enter в поле добавления привычки
newHabitInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addBtn.click();
  }
});

// Обработка Enter в поле нового пользователя
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    setUserBtn.click();
  }
});

select.addEventListener('change', () => {
  const selectedName = select.value;
  if (selectedName) {
    setUser(selectedName);
  }
});

// 🏠 Кнопка возврата к сегодня
const todayBtn = document.getElementById('today-btn');
todayBtn.onclick = () => {
  // Находим индекс сегодняшней даты
  const todayIndex = allDates.findIndex(d => d.isToday);
  if (todayIndex !== -1) {
    slideOffset = todayIndex;
    render();
  }
};

// 📊 Статистика
const statsBtn = document.getElementById('stats-btn');
const statsPanel = document.getElementById('stats-panel');
const monthSelect = document.getElementById('month-select');
const statsContent = document.getElementById('stats-content');

statsBtn.onclick = () => {
  statsPanel.classList.toggle('hidden');
  if (!statsPanel.classList.contains('hidden')) {
    loadMonthOptions();
  }
};

function loadMonthOptions() {
  if (!userData) return;
  
  monthSelect.innerHTML = '<option value="">Выберите месяц</option>';
  const availableMonths = generateAvailableMonths();
  
  availableMonths.forEach(month => {
    const option = document.createElement('option');
    option.value = month.key;
    option.textContent = month.name;
    monthSelect.appendChild(option);
  });
}

monthSelect.addEventListener('change', () => {
  const selectedMonth = monthSelect.value;
  if (!selectedMonth || !userData) {
    statsContent.innerHTML = '<p>Выберите месяц для просмотра статистики</p>';
    return;
  }
  
  const [year, month] = selectedMonth.split('-').map(Number);
  showMonthStats(year, month);
});

function showMonthStats(year, month) {
  const monthName = new Date(year, month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  
  let html = `<h4>📈 Статистика за ${monthName}</h4>`;
  
  if (userData.habits.length === 0) {
    html += '<p>Нет привычек для отображения статистики</p>';
  } else {
    userData.habits.forEach(habit => {
      const progress = getMonthProgress(habit, year, month);
      
      html += `
        <div class="habit-stats">
          <div class="habit-stats-header">${habit}</div>
          <div class="habit-stats-progress">
            <div class="habit-stats-bar">
              <div class="habit-stats-fill" style="width: ${progress.percentage}%"></div>
            </div>
            <div class="habit-stats-text">${progress.completed}/${progress.total} (${progress.percentage}%)</div>
          </div>
        </div>
      `;
    });
  }
  
  statsContent.innerHTML = html;
}

// Модалка удаления пользователя
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
    // Удаляем пользователя из localStorage
    try {
      if (typeof Storage !== 'undefined') {
        localStorage.removeItem('habit_' + userName);
      }
    } catch (e) {
      console.warn('Ошибка удаления пользователя:', e);
    }
    
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

// Закрытие модалки по клику вне неё
confirmModal.onclick = (e) => {
  if (e.target === confirmModal) {
    confirmModal.classList.add('hidden');
  }
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

// Предотвращение зума на двойное касание на iOS
document.addEventListener('touchstart', function(event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });
