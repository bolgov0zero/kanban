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
		name: colName.value,
		bg_color: colBg.value,
		task_color: taskBg.value,
		auto_complete: autoComplete.checked ? 1 : 0,
		timer: document.getElementById('timer').checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}

function updateColumn(id) {
	let data = new URLSearchParams({
		action: 'update_column',
		id,
		name: colName.value,
		bg_color: colBg.value,
		task_color: taskBg.value,
		auto_complete: autoComplete.checked ? 1 : 0,
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
		title: title.value,
		description: desc.value,
		responsible: resp.value,
		deadline: deadline.value,
		importance: imp.value,
		column_id: col.value
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function updateTask(id) {
	let data = new URLSearchParams({
		action: 'update_task',
		id,
		title: title.value,
		description: desc.value,
		responsible: resp.value,
		deadline: deadline.value,
		importance: imp.value
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
			let colOptions = ''; // Загрузить колонки динамически, если нужно
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать задачу</h2>
				<label class='block mb-1 text-sm text-gray-400'>Заголовок:</label>
				<input id='title' value='${t.title}' class='w-full mb-3 p-2 rounded bg-gray-700'>
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
		});
}

// === Универсальная функция открытия модалки (если openModal не определена) ===
function openModal(content) {
	document.getElementById('modal-content').innerHTML = content;
	document.getElementById('modal-bg').classList.remove('hidden');
}

// === Настройки пользователей и Telegram ===
function loadUsersList() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(data => {
			const list = document.getElementById('users-list');
			if (!list) return;
			list.innerHTML = data.map(u => `
				<div class="flex justify-between items-center p-2 bg-gray-700 rounded">
					<span>${u.username} (${u.name || ''}) ${u.is_admin ? '(Админ)' : ''}</span>
					<div class="flex gap-1">
						<button onclick="editUser('${u.username}')" class="text-blue-400 hover:text-blue-300">✏️</button>
						<button onclick="deleteUser('${u.username}')" class="text-red-400 hover:text-red-300">🗑️</button>
					</div>
				</div>
			`).join('');
		})
		.catch(err => console.error('Ошибка загрузки пользователей:', err));
}

function openUserSettings() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) })
		.then(r => r.json())
		.then(tg => {
			const modalHTML = `
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Настройки администратора</h2>

				<!-- Вкладки -->
				<div class="flex mb-4 bg-gray-700 rounded-t-lg overflow-hidden">
					<button id="tab-users" class="flex-1 py-2 px-4 border-b-2 border-blue-500 text-blue-300 bg-gray-600 hover:bg-gray-500">👥 Пользователи</button>
					<button id="tab-telegram" class="flex-1 py-2 px-4 border-b-2 border-transparent text-gray-400 bg-gray-800 hover:bg-gray-700">📱 Telegram</button>
					<button id="tab-notifications" class="flex-1 py-2 px-4 border-b-2 border-transparent text-gray-400 bg-gray-800 hover:bg-gray-700">🔔 Уведомления</button>
				</div>

				<!-- Контент вкладки "Пользователи" (по умолчанию видим) -->
				<div id="content-users" class="space-y-3 p-4 bg-gray-800 rounded-b-lg">
					<div class="flex flex-wrap gap-2 mb-4">
						<input id="newUser" placeholder="Новый логин" class="flex-1 min-w-[120px] p-2 rounded bg-gray-700">
						<input id="newPass" type="password" placeholder="Пароль" class="flex-1 min-w-[120px] p-2 rounded bg-gray-700">
						<input id="newName" placeholder="Имя" class="flex-1 min-w-[120px] p-2 rounded bg-gray-700">
						<label class="flex items-center gap-1 p-2 bg-gray-700 rounded"><input id="newIsAdmin" type="checkbox"> Админ</label>
						<button onclick="addUser()" class="bg-blue-600 hover:bg-blue-500 text-sm py-2 px-4 rounded whitespace-nowrap">➕ Добавить</button>
					</div>
					<div id="users-list" class="space-y-2 max-h-60 overflow-y-auto">
						<!-- Список пользователей загружается динамически -->
					</div>
				</div>

				<!-- Контент вкладки "Telegram" (скрыт) -->
				<div id="content-telegram" class="hidden space-y-3 p-4 bg-gray-800 rounded-b-lg">
					<div class="grid grid-cols-1 gap-2">
						<input id="tgToken" value="${tg.bot_token || ''}" placeholder="Bot Token" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
						<input id="tgChat" value="${tg.chat_id || ''}" placeholder="Chat ID" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
						<div class="flex gap-2 pt-2">
							<button onclick="saveSettings()" class="flex-1 bg-green-600 hover:bg-green-500 text-sm py-2 rounded transition-colors">💾 Сохранить</button>
							<button onclick="testTelegram()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-sm py-2 rounded transition-colors">🧪 Тест</button>
						</div>
					</div>
				</div>

				<!-- Контент вкладки "Уведомления" (скрыт) -->
				<div id="content-notifications" class="hidden space-y-3 p-4 bg-gray-800 rounded-b-lg">
					<div class="grid grid-cols-1 gap-2">
						<label class="block mb-1 text-sm text-gray-400">Порог таймера (минуты): после этого времени отправлять уведомление о превышении</label>
						<input id="timerThreshold" type="number" value="${tg.timer_threshold || 60}" min="1" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500 w-full">
						<div class="flex gap-2 pt-2">
							<button onclick="saveSettings()" class="flex-1 bg-green-600 hover:bg-green-500 text-sm py-2 rounded transition-colors">💾 Сохранить</button>
						</div>
					</div>
				</div>
			`;

			document.getElementById('modal-content').innerHTML = modalHTML;
			document.getElementById('modal-content').className = 'bg-gray-800 p-0 rounded-xl w-[42rem] max-h-[80vh] overflow-y-auto relative shadow-lg border border-gray-700 max-w-[95vw]';
			document.getElementById('modal-bg').classList.remove('hidden');

			// Загрузка списка пользователей
			loadUsersList();

			// Привязка onclick с улучшениями
			const tabs = {
				'users': 'content-users',
				'telegram': 'content-telegram',
				'notifications': 'content-notifications'
			};
			const tabButtons = ['tab-users', 'tab-telegram', 'tab-notifications'];

			tabButtons.forEach(tabId => {
				document.getElementById(tabId).onclick = (e) => {
					e.preventDefault();
					Object.keys(tabs).forEach(key => {
						const contentId = tabs[key];
						const buttonId = `tab-${key}`;
						if (key === tabId.replace('tab-', '')) {
							document.getElementById(contentId).classList.remove('hidden');
							document.getElementById(buttonId).classList.add('border-blue-500', 'text-blue-300', 'bg-gray-600');
							document.getElementById(buttonId).classList.remove('border-transparent', 'text-gray-400', 'bg-gray-800');
						} else {
							document.getElementById(contentId).classList.add('hidden');
							document.getElementById(buttonId).classList.remove('border-blue-500', 'text-blue-300', 'bg-gray-600');
							document.getElementById(buttonId).classList.add('border-transparent', 'text-gray-400', 'bg-gray-800');
						}
					});
				};
			});
		})
		.catch(err => {
			console.error('Ошибка открытия настроек:', err);
			alert('Ошибка загрузки настроек. Проверьте консоль.');
		});
}

function saveSettings() {
	const tokenEl = document.getElementById('tgToken');
	const chatEl = document.getElementById('tgChat');
	const thresholdEl = document.getElementById('timerThreshold');
	let data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: tokenEl ? tokenEl.value : '',
		chat_id: chatEl ? chatEl.value : '',
		timer_threshold: thresholdEl ? thresholdEl.value : 60
	});
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Сохранено!' : 'Ошибка сохранения'))
		.catch(err => console.error('Ошибка сохранения:', err));
}

function testTelegram() {
	let data = new URLSearchParams({ action: 'test_telegram' });
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success || 'Ошибка'))
		.catch(err => console.error('Ошибка теста Telegram:', err));
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
		password: document.getElementById('editPass').value, // пустой = не менять
		is_admin: document.getElementById('editIsAdmin').checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}

function addUser() {
	let data = new URLSearchParams({
		action: 'add_user',
		username: newUser.value,
		password: newPass.value,
		name: newName.value,
		is_admin: newIsAdmin.checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function deleteUser(name) {
	if (!confirm(`Удалить ${name}?`)) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'delete_user', username: name }) })
		.then(() => location.reload());
}

// Загрузка пользователей при старте
loadUsers();