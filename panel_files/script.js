// === Drag & Drop ===
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.id); }
function highlightDrop(el, on) { if (on) el.classList.add('drop-hover'); else el.classList.remove('drop-hover'); }

function drop(ev) {
	ev.preventDefault();
	let taskId = ev.dataTransfer.getData("text").replace('task', '');
	let colId  = ev.currentTarget.dataset.colId;
	let task   = document.getElementById('task' + taskId);
	let target = ev.currentTarget.querySelector('#col' + colId);
	if (!target) return;
	target.appendChild(task);

	let bg = ev.currentTarget.dataset.taskColor || '#374151';
	let txt = getContrastColor(bg);
	task.style.background = bg;
	task.style.color = txt;

	ev.currentTarget.classList.remove('drop-hover');

	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'move_task', task_id: taskId, column_id: colId })
	}).then(() => location.reload());
}

function getContrastColor(hex) {
	if (!hex) return '#fff';
	hex = hex.replace('#', '');
	if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
	let r = parseInt(hex.substr(0, 2), 16);
	let g = parseInt(hex.substr(2, 2), 16);
	let b = parseInt(hex.substr(4, 2), 16);
	return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#000' : '#fff';
}

// === Колонки ===
function saveColumn() {
	let data = new URLSearchParams({
		action: 'add_column',
		name: document.getElementById('colName').value,
		bg_color: document.getElementById('colBg').value,
		task_color: document.getElementById('taskBg').value,
		auto_complete: document.getElementById('autoComplete').checked ? 1 : 0,
		timer: document.getElementById('timer').checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}

function updateColumn(id) {
	let data = new URLSearchParams({
		action: 'update_column',
		id,
		name: document.getElementById('colName').value,
		bg_color: document.getElementById('colBg').value,
		task_color: document.getElementById('taskBg').value,
		auto_complete: document.getElementById('autoComplete').checked ? 1 : 0,
		timer: document.getElementById('timer').checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function deleteColumn(id) {
	if (!confirm('Удалить колонку и все задачи в ней?')) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'delete_column', id }) })
		.then(() => location.reload());
}
function editColumn(id) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_column', id }) })
		.then(r => r.json())
		.then(c => {
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать колонку</h2>
				<label class='block mb-1 text-sm text-gray-400'>Название:</label>
				<input id='colName' value='${c.name}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Цвет заголовка:</label>
				<input id='colBg' type='color' value='${c.bg_color}' class='w-full mb-3 h-10 rounded'>
				<label class='block mb-1 text-sm text-gray-400'>Цвет задач:</label>
				<input id='taskBg' type='color' value='${c.task_color}' class='w-full mb-3 h-10 rounded'>
				<label class='flex items-center gap-2 mb-3'>
					<input id='autoComplete' type='checkbox' ${c.auto_complete == 1 ? 'checked' : ''}>
					<span class='text-sm'>Автозавершать</span>
				</label>
				<label class='flex items-center gap-2 mb-3'>
					<input id='timer' type='checkbox' ${c.timer == 1 ? 'checked' : ''}>
					<span class='text-sm'>Таймер (время в колонке)</span>
				</label>
				<div class='flex gap-2'>
					<button onclick='updateColumn(${id})' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='deleteColumn(${id})' class='flex-1 bg-red-700 hover:bg-red-600 p-2 rounded'>Удалить</button>
				</div>
			`);
		});
}

// === Задачи ===
let users = []; // глобальный массив пользователей для select
function loadUsers() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(data => users = data);
}

function saveTask() {
	let data = new URLSearchParams({
		action: 'add_task',
		title: document.getElementById('title').value,
		description: document.getElementById('desc').value,
		responsible: document.getElementById('resp').value,
		deadline: document.getElementById('deadline').value,
		importance: document.getElementById('imp').value,
		column_id: document.getElementById('col').value
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function updateTask(id) {
	let data = new URLSearchParams({
		action: 'update_task',
		id,
		title: document.getElementById('title').value,
		description: document.getElementById('desc').value,
		responsible: document.getElementById('resp').value,
		deadline: document.getElementById('deadline').value,
		importance: document.getElementById('imp').value
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function deleteTask(id) {
	if (!confirm('Удалить задачу?')) return;
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'delete_task', id })
	})
		.then(() => location.reload());
}
function editTask(id) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_task', id }) })
		.then(r => r.json())
		.then(t => {
			let respOptions = users.map(u => `<option value='${u.username}' ${t.responsible === u.username ? 'selected' : ''}>${u.name || u.username}</option>`).join('');
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать задачу</h2>
				<label class='block mb-1 text-sm text-gray-400'>Заголовок:</label>
				<input id='title' value='${t.title || ''}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Описание:</label>
				<textarea id='desc' class='w-full mb-3 p-2 rounded bg-gray-700'>${t.description || ''}</textarea>
				<label class='block mb-1 text-sm text-gray-400'>Исполнитель:</label>
				<select id='resp' class='w-full mb-3 p-2 rounded bg-gray-700'>${respOptions}</select>
				<label class='block mb-1 text-sm text-gray-400'>Срок выполнения:</label>
				<input id='deadline' type='date' value='${t.deadline || ''}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Степень важности:</label>
				<select id='imp' class='w-full mb-3 p-2 rounded bg-gray-700'>
					<option value='не срочно' ${t.importance === 'не срочно' ? 'selected' : ''}>🟩 Не срочно</option>
					<option value='средне' ${t.importance === 'средне' ? 'selected' : ''}>🟨 Средне</option>
					<option value='срочно' ${t.importance === 'срочно' ? 'selected' : ''}>🟥 Срочно</option>
				</select>
				<div class='flex gap-2'>
					<button onclick='updateTask(${id})' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='deleteTask(${id})' class='flex-1 bg-red-700 hover:bg-red-600 p-2 rounded'>Удалить</button>
				</div>
			`);
		})
		.catch(err => {
			console.error('Ошибка редактирования задачи:', err);
			alert('Ошибка загрузки задачи. Проверьте ID.');
		});
}

// === Универсальная функция открытия модалки ===
function openModal(content) {
	document.getElementById('modal-content').innerHTML = content;
	document.getElementById('modal-bg').classList.remove('hidden');
}

// === Настройки пользователей и Telegram (новый дизайн) ===
let usersList = []; // Для поиска
function loadUsersList() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(data => {
			usersList = data;
			filterUsers('');  // Инициализируем список
		})
		.catch(err => console.error('Ошибка загрузки пользователей:', err));
}

function filterUsers(query) {
	const list = document.getElementById('users-list');
	if (!list) return;
	const filtered = usersList.filter(u => u.username.toLowerCase().includes(query.toLowerCase()) || (u.name && u.name.toLowerCase().includes(query.toLowerCase())));
	list.innerHTML = filtered.map(u => `
		<div class="flex justify-between items-center p-3 bg-gray-700/50 rounded-md border border-gray-600">
			<div class="flex-1">
				<div class="font-medium">${u.username}</div>
				<div class="text-sm text-gray-400">${u.name || ''} ${u.is_admin ? '(Админ)' : ''}</div>
			</div>
			<div class="flex gap-2">
				<button onclick="editUser('${u.username}')" class="p-1 text-blue-400 hover:text-blue-300 rounded">✏️</button>
				<button onclick="deleteUser('${u.username}')" class="p-1 text-red-400 hover:text-red-300 rounded">🗑️</button>
			</div>
		</div>
	`).join('');
}

function openUserSettings() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) })
		.then(r => r.json())
		.then(tg => {
			const modalHTML = `
				<div class="relative bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-w-4xl max-h-[80vh] overflow-y-auto w-[min(90vw,48rem)]">
					<button onclick="closeModal()" class="absolute z-10 right-4 top-4 text-gray-400 hover:text-white text-xl font-bold">&times;</button>
					<h2 class="text-2xl font-bold text-center p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">Настройки администратора</h2>
					
					<!-- Вкладки: строгий bar -->
					<div class="flex border-b border-gray-600 bg-gray-700">
						<button id="tab-users" class="flex-1 py-3 px-6 text-sm font-medium text-gray-300 hover:text-white border-b-2 border-blue-500 bg-blue-50/10">👥 Пользователи</button>
						<button id="tab-telegram" class="flex-1 py-3 px-6 text-sm font-medium text-gray-400 hover:text-gray-300 border-b-2 border-transparent">📱 Telegram</button>
						<button id="tab-notifications" class="flex-1 py-3 px-6 text-sm font-medium text-gray-400 hover:text-gray-300 border-b-2 border-transparent">🔔 Уведомления</button>
					</div>

					<!-- Вкладка Пользователи -->
					<div id="content-users" class="p-6 space-y-4">
						<div class="flex gap-2 mb-4">
							<input id="userSearch" placeholder="Поиск по логину/имени..." class="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500" oninput="filterUsers(this.value)">
						</div>
						<div class="flex gap-3 mb-4">
							<input id="newUser" placeholder="Логин" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600">
							<input id="newPass" type="password" placeholder="Пароль" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600">
							<input id="newName" placeholder="Имя" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600">
							<button onclick="addUser()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white whitespace-nowrap">➕ Добавить</button>
						</div>
						<div id="users-list" class="space-y-2 max-h-64 overflow-y-auto"></div>
					</div>

					<!-- Вкладка Telegram -->
					<div id="content-telegram" class="hidden p-6 space-y-4">
						<div class="grid grid-cols-1 gap-4">
							<div>
								<label class="block mb-1 text-sm font-medium text-gray-300">Bot Token</label>
								<input id="tgToken" value="${tg.bot_token || ''}" placeholder="123456:ABC-DEF..." class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500">
							</div>
							<div>
								<label class="block mb-1 text-sm font-medium text-gray-300">Chat ID</label>
								<input id="tgChat" value="${tg.chat_id || ''}" placeholder="-1001234567890" class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500">
							</div>
							<div class="flex gap-3">
								<button onclick="saveSettings()" class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white">💾 Сохранить</button>
								<button onclick="testTelegram()" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white">🧪 Тест</button>
								<button onclick="validateToken()" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white">🔍 Проверить токен</button>
							</div>
						</div>
					</div>

					<!-- Вкладка Уведомления -->
					<div id="content-notifications" class="hidden p-6 space-y-4">
						<div class="grid grid-cols-1 gap-4">
							<div>
								<label class="block mb-1 text-sm font-medium text-gray-300">Порог таймера (минуты)</label>
								<input id="timerThreshold" type="number" value="${tg.timer_threshold || 60}" min="1" class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500">
								<p class="text-xs text-gray-500 mt-1">После этого времени в колонке с таймером отправлять уведомление</p>
							</div>
							<button onclick="saveSettings()" class="w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-white">💾 Сохранить</button>
						</div>
					</div>

					<!-- Кнопка "Сохранить все" внизу -->
					<div class="p-6 bg-gray-900 border-t border-gray-600">
						<button onclick="saveAllSettings()" class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium">💾 Сохранить все изменения</button>
					</div>
				</div>
			`;

			document.getElementById('modal-content').innerHTML = modalHTML;
			document.getElementById('modal-content').className = 'relative';
			document.getElementById('modal-bg').classList.remove('hidden');

			// Загрузка списка пользователей
			loadUsersList();

			// Вкладки: улучшенная логика
			const tabs = {
				users: 'content-users',
				telegram: 'content-telegram',
				notifications: 'content-notifications'
			};
			Object.keys(tabs).forEach(key => {
				document.getElementById(`tab-${key}`).onclick = () => {
					Object.keys(tabs).forEach(k => {
						const content = document.getElementById(tabs[k]);
						const button = document.getElementById(`tab-${k}`);
						if (k === key) {
							content.classList.remove('hidden');
							button.classList.add('border-blue-500', 'text-white', 'bg-blue-50/10');
							button.classList.remove('text-gray-400', 'border-transparent');
						} else {
							content.classList.add('hidden');
							button.classList.remove('border-blue-500', 'text-white', 'bg-blue-50/10');
							button.classList.add('text-gray-400', 'border-transparent');
						}
					});
				};
			});

			// ESC для закрытия
			document.addEventListener('keydown', function escClose(e) {
				if (e.key === 'Escape') closeModal();
			}, { once: true });
		})
		.catch(err => {
			console.error('Ошибка открытия настроек:', err);
			alert('Ошибка загрузки настроек.');
		});
}

// Новые функции для функциональности
function validateToken() {
	const token = document.getElementById('tgToken').value;
	if (!token) return alert('Введите токен');
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'test_telegram' }) })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Токен валиден!' : 'Ошибка: ' + res.message));
}

function saveAllSettings() {
	saveSettings();  // Сохраняет из всех вкладок
	closeModal();
}

function saveSettings() {
	const tokenEl = document.getElementById('tgToken');
	const chatEl = document.getElementById('tgChat');
	const thresholdEl = document.getElementById('timerThreshold');
	if (thresholdEl && parseInt(thresholdEl.value) < 1) {
		return alert('Порог должен быть ≥1 минуты');
	}
	let data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: tokenEl ? tokenEl.value : '',
		chat_id: chatEl ? chatEl.value : '',
		timer_threshold: thresholdEl ? thresholdEl.value : 60
	});
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success ? res.message : 'Ошибка: ' + res.message))
		.catch(err => console.error('Ошибка сохранения:', err));
}

function testTelegram() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'test_telegram' }) })
		.then(r => r.json())
		.then(res => alert(res.success ? '✅ ' + res.message : '❌ ' + res.message))
		.catch(err => alert('Ошибка сети'));
}

// === Редактирование пользователя ===
function editUser(username) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_user', username }) })
		.then(r => r.json())
		.then(u => {
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать пользователя</h2>
				<label class='block mb-1 text-sm text-gray-400'>Логин (нельзя изменить):</label>
				<input id='editUser' value='${u.username}' class='w-full mb-3 p-2 rounded bg-gray-600' readonly>
				<label class='block mb-1 text-sm text-gray-400'>Имя:</label>
				<input id='editName' value='${u.name || ''}' class='w-full mb-3 p-2 rounded bg-gray-700' placeholder='Полное имя'>
				<label class='block mb-1 text-sm text-gray-400'>Новый пароль (оставьте пустым, чтобы не менять):</label>
				<input id='editPass' type='password' class='w-full mb-3 p-2 rounded bg-gray-700' placeholder='Новый пароль'>
				<div class='flex items-center gap-2 mb-3'>
					<input id='editIsAdmin' type='checkbox' ${u.is_admin ? 'checked' : ''}>
					<label for='editIsAdmin' class='text-sm'>Администратор</label>
				</div>
				<div class='flex gap-2'>
					<button onclick='updateUser("${u.username}")' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='closeModal()' class='flex-1 bg-gray-600 hover:bg-gray-500 p-2 rounded'>Отмена</button>
				</div>
			`);
		});
}

function updateUser(username) {
	let data = new URLSearchParams({
		action: 'update_user',
		username,
		name: document.getElementById('editName').value,
		password: document.getElementById('editPass').value,
		is_admin: document.getElementById('editIsAdmin').checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}

function addUser() {
	let data = new URLSearchParams({
		action: 'add_user',
		username: document.getElementById('newUser').value,
		password: document.getElementById('newPass').value,
		name: document.getElementById('newName').value,
		is_admin: document.getElementById('newIsAdmin').checked ? 1 : 0
	});
	if (!data.get('username') || !data.get('password')) return alert('Логин и пароль обязательны');
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function deleteUser(name) {
	if (!confirm(`Удалить ${name}?`)) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'delete_user', username: name }) })
		.then(() => location.reload());
}

// Загрузка пользователей при старте
loadUsers();