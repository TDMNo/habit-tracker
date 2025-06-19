// index.js

// 🔧 Получение DOM-элементов
const select = document.getElementById('user-select');
const input = document.getElementById('new-user');
const button = document.getElementById('create-user');

/**
 * 📦 Получение всех участников из localStorage
 * Участники хранятся под ключами вида 'habit_<имя>'
 */
function loadUsers() {
  select.innerHTML = ''; // Очистка выпадающего списка
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
 * ➕ Обработка создания нового участника
 * Если такого ещё нет — создаём и переходим
 */
button.addEventListener('click', () => {
  const name = input.value.trim();
  if (!name) return alert('Введите имя');
  const key = 'habit_' + name;
  if (!localStorage.getItem(key)) {
    const newUserData = {
      name,
      habits: [],
      data: {} // Дата: { привычка: статус }
    };
    localStorage.setItem(key, JSON.stringify(newUserData));
  }
  window.location.href = `user.html?name=${encodeURIComponent(name)}`;
});

// 🚚 Загрузка списка участников при старте
loadUsers();
