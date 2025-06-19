// app.js
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('name');
const title = document.getElementById('username');
const table = document.getElementById('habit-table').querySelector('tbody');
const dayHeaders = [document.getElementById('day1'), document.getElementById('day2'), document.getElementById('day3')];
const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');

if (!userName) location.href = 'index.html';
title.textContent = `Привычки: ${userName}`;

const storageKey = 'habit_' + userName;
let userData = JSON.parse(localStorage.getItem(storageKey)) || { name: userName, habits: [], data: {} };

// Генерация трёх дат: вчера, сегодня, завтра
function getThreeDays() {
  const now = new Date();
  const days = [-1, 0, 1].map(offset => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return {
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'numeric' }),
      key: d.toISOString().split('T')[0]
    };
  });
  return days;
}

let days = getThreeDays();
dayHeaders.forEach((th, i) => th.textContent = days[i].label);

// Очистка старых данных
function cleanupOldData() {
  const keep = new Set(days.map(d => d.key));
  for (let date in userData.data) {
    if (!keep.has(date)) delete userData.data[date];
  }
}

// Обновление localStorage
function saveData() {
  cleanupOldData();
  localStorage.setItem(storageKey, JSON.stringify(userData));
}

// Отображение таблицы
function render() {
  table.innerHTML = '';
  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // Удаление
    const delBtn = document.createElement('td');
    delBtn.innerHTML = '🗑️';
    delBtn.style.cursor = 'pointer';
    delBtn.onclick = () => {
      userData.habits = userData.habits.filter(h => h !== habit);
      userData.habits.length === 0 && (userData.data = {});
      saveData();
      render();
    };
    tr.appendChild(delBtn);

    // Название привычки
    const tdName = document.createElement('td');
    tdName.textContent = habit;
    tr.appendChild(tdName);

    // Ячейки по дням
    days.forEach(d => {
      const td = document.createElement('td');
      td.className = 'circle';
      const status = userData.data?.[d.key]?.[habit] || null;
      td.dataset.status = status || '';
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

    // Прогресс
    const tdProgress = document.createElement('td');
    const count = days.filter(d => userData.data[d.key]?.[habit] === 'done').length;
    tdProgress.textContent = `${count} / 3`;
    tr.appendChild(tdProgress);

    table.appendChild(tr);
  });
}

addBtn.onclick = () => {
  const habit = newHabitInput.value.trim();
  if (habit && !userData.habits.includes(habit)) {
    userData.habits.push(habit);
    saveData();
    render();
    newHabitInput.value = '';
  }
};

render();
