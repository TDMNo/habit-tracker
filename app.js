// app.js
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('name');
const title = document.getElementById('username');
const table = document.getElementById('habit-table').querySelector('tbody');
const dayHeaders = [document.getElementById('day1'), document.getElementById('day2'), document.getElementById('day3')];
const addBtn = document.getElementById('add-btn');
const newHabitInput = document.getElementById('new-habit');
const rangeInput = document.getElementById('day-range');

if (!userName) location.href = 'index.html';
title.textContent = `Привычки:  ${userName}`;

const storageKey = 'habit_' + userName;
let userData = JSON.parse(localStorage.getItem(storageKey)) || { name: userName, habits: [], data: {} };

let offset = 0;
rangeInput.addEventListener('input', () => {
  offset = parseInt(rangeInput.value);
  render();
});

function getNDates(centerOffset = 0, range = 1) {
  const base = new Date();
  base.setDate(base.getDate() + centerOffset);
  return Array.from({ length: range * 2 + 1 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i - range);
    return {
      label: d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      key: d.toISOString().split('T')[0]
    };
  });
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(userData));
}

function render() {
  const visibleDays = getNDates(offset, 1); // три дня вокруг offset
  const progressDays = getNDates(offset, 3); // 7 дней вокруг offset

  visibleDays.forEach((d, i) => dayHeaders[i].textContent = d.label);

  table.innerHTML = '';
  userData.habits.forEach(habit => {
    const tr = document.createElement('tr');

    // 🗑️ delete
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

    // Название привычки
    const tdName = document.createElement('td');
    tdName.className = 'name-col';
    tdName.textContent = habit;
    tr.appendChild(tdName);

    // 3 даты
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

    // Прогресс бар за 7 дней
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
