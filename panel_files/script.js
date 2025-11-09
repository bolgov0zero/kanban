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
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">Close</button>
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
					<span class='text-sm'>Таймер</span>
				</label>
				<div class='flex gap-2'>
					<button onclick='updateColumn(${id})' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='deleteColumn(${id})' class='flex-1 bg-red-700 hover:bg-red-600 p-2 rounded'>Удалить</button>
				</div>
			`);
		});
}

// === Задачи ===
let users = [];
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
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">Close</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать задачу</h2>
				<label class='block mb-1 text-sm text-gray-400'>Заголовок:</label>
				<input id='title' value='${t.title || ''}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Описание:</label>
				<textarea id='desc' class='w-full mb-3 p-2 rounded bg-gray-700'>${t.description || ''}</textarea>
				<label class='block mb-1 text-sm text-gray-400'>Исполнитель:</label>
				<select id='resp' class='w-full mb-3 p-2 rounded bg-gray-700'>${respOptions}</select>
				<label class='block mb-1 text-sm text-gray-400'>Срок:</label>
				<input id='deadline' type='date' value='${t.deadline || ''}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Важность:</label>
				<select id='imp' class='w-full mb-3 p-2 rounded bg-gray-700'>
					<option value='не срочно' ${t.importance === 'не срочно' ? 'selected' : ''}>Не срочно</option>
					<option value='средне' ${t.importance === 'средне' ? 'selected' : ''}>Средне</option>
					<option value='срочно' ${t.importance === 'срочно' ? 'selected' : ''}>Срочно</option>
				</select>
				<div class='flex gap-2'>
					<button onclick='updateTask(${id})' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='deleteTask(${id})' class='flex-1 bg-red-700 hover:bg-red-600 p-2 rounded'>Удалить</button>
				</div>
			`);
		})
		.catch(err => {
			console.error('Ошибка редактирования задачи:', err);
			alert('Не удалось загрузить задачу.');
		});
}

// === Модальное окно ===
function openModal(content) {
	document.getElementById('modal-bg').innerHTML = `
		<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
			<div class="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-gray-700">
				${content}
			</div>
		</div>
	`;
	document.getElementById('modal-bg').classList.remove('hidden');
}
function closeModal() {
	document.getElementById('modal-bg').classList.add('hidden');
	document.getElementById('modal-bg').innerHTML = '';
}

// === НАСТРОЙКИ АДМИНИСТРАТОРА (профессиональный дизайн) ===
let usersList = [];
function loadUsersList() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(data => {
			usersList = data;
			renderUsers('');
		});
}
function renderUsers(filter = '') {
	const list = document.getElementById('users-list');
	if (!list) return;
	const filtered = usersList.filter(u =>
		u.username.toLowerCase().includes(filter.toLowerCase()) ||
		(u.name && u.name.toLowerCase().includes(filter.toLowerCase()))
	);
	list.innerHTML = filtered.map(u => `
		<div class="flex justify-between items-center p-2 bg-gray-700/50 rounded border border-gray-600">
			<div>
				<div class="font-medium text-sm">${u.username}</div>
				<div class="text-xs text-gray-400">${u.name||''} ${u.is_admin?'(Админ)':''}</div>
			</div>
			<div class="flex gap-1">
				<button onclick="editUser('${u.username}')" class="text-blue-400 hover:text-blue-300 text-xs">Edit</button>
				<button onclick="deleteUser('${u.username}')" class="text-red-400 hover:text-red-300 text-xs">Delete</button>
			</div>
		</div>
	`).join('');
}
document.addEventListener('input', e => {
	if (e.target.id === 'userSearch') renderUsers(e.target.value);
});

function openUserSettings() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) })
		.then(r => r.json())
		.then(tg => {
			const html = `
<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
	<div class="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-gray-700">
		<!-- Заголовок -->
		<div class="flex items-center justify-between p-5 border-b border-gray-700">
			<h2 class="text-xl font-semibold text-gray-100">Настройки администратора</h2>
			<button onclick="closeModal()" class="text-gray-400 hover:text-gray-200 text-2xl">&times;</button>
		</div>

		<!-- Вкладки -->
		<div class="flex border-b border-gray-700">
			<button id="tab-users"       class="tab-btn active">Пользователи</button>
			<button id="tab-telegram"    class="tab-btn">Telegram</button>
			<button id="tab-notify"      class="tab-btn">Уведомления</button>
		</div>

		<!-- Пользователи -->
		<div id="content-users" class="tab-content p-5 space-y-4">
			<input id="userSearch" placeholder="Поиск…" class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 text-sm">
			<div class="flex gap-2">
				<input id="newUser" placeholder="Логин" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm">
				<input id="newPass" type="password" placeholder="Пароль" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm">
				<input id="newName" placeholder="Имя" class="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-sm">
				<button onclick="addUser()" class="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white">Добавить</button>
			</div>
			<div id="users-list" class="space-y-2 max-h-64 overflow-y-auto"></div>
		</div>

		<!-- Telegram -->
		<div id="content-telegram" class="tab-content hidden p-5 space-y-4">
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Bot Token</label>
				<input id="tgToken" value="${tg.bot_token||''}" placeholder="123456:ABC-DEF..." class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500 text-sm">
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Chat ID</label>
				<input id="tgChat" value="${tg.chat_id||''}" placeholder="-1001234567890" class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500 text-sm">
			</div>
			<div class="flex gap-2">
				<button onclick="saveSettings()" class="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded text-sm text-white">Сохранить</button>
				<button onclick="testTelegram()" class="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white">Тест</button>
			</div>
		</div>

		<!-- Уведомления -->
		<div id="content-notify" class="tab-content hidden p-5 space-y-4">
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1">Порог таймера (минуты)</label>
				<input id="timerThreshold" type="number" min="1" value="${tg.timer_threshold||60}" class="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-green-500 text-sm">
				<p class="text-xs text-gray-500 mt-1">После этого времени будет отправлено уведомление.</p>
			</div>
			<button onclick="saveSettings()" class="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-sm text-white">Сохранить</button>
		</div>

		<!-- Футер -->
		<div class="flex justify-end p-4 border-t border-gray-700">
			<button onclick="closeModal()" class="px-4 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white">Закрыть</button>
		</div>
	</div>
</div>
			`;

			document.getElementById('modal-bg').innerHTML = html;
			document.getElementById('modal-bg').classList.remove('hidden');

			loadUsersList();
			setupTabs();
			document.getElementById('userSearch').focus();
		})
		.catch(err => {
			console.error('Ошибка загрузки настроек:', err);
			alert('Не удалось загрузить настройки.');
		});
}

function setupTabs() {
	const tabs = {
		users:    'content-users',
		telegram: 'content-telegram',
		notify:   'content-notify'
	};
	Object.keys(tabs).forEach(key => {
		document.getElementById(`tab-${key}`).onclick = () => {
			Object.values(tabs).forEach(id => document.getElementById(id).classList.add('hidden'));
			document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
			document.getElementById(tabs[key]).classList.remove('hidden');
			document.getElementById(`tab-${key}`).classList.add('active');
		};
	});
}

function saveSettings() {
	const threshold = parseInt(document.getElementById('timerThreshold').value);
	if (isNaN(threshold) || threshold < 1) return alert('Порог ≥ 1 минуты');
	const data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: document.getElementById('tgToken').value,
		chat_id:   document.getElementById('tgChat').value,
		timer_threshold: threshold
	});
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Сохранено' : res.message || 'Ошибка'));
}

function testTelegram() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'test_telegram' }) })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Отправлено' : res.message || 'Ошибка'));
}

function addUser() {
	const login = document.getElementById('newUser').value.trim();
	const pass  = document.getElementById('newPass').value;
	if (!login || !pass) return alert('Логин и пароль обязательны');
	const data = new URLSearchParams({
		action: 'add_user',
		username: login,
		password: pass,
		name: document.getElementById('newName').value,
		is_admin: document.getElementById('newIsAdmin')?.checked ? 1 : 0
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}

// === Пользователи: редактирование, удаление ===
function editUser(username) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_user', username }) })
		.then(r => r.json())
		.then(u => {
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">Close</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать пользователя</h2>
				<label class='block mb-1 text-sm text-gray-400'>Логин:</label>
				<input id='editUser' value='${u.username}' class='w-full mb-3 p-2 rounded bg-gray-600' readonly>
				<label class='block mb-1 text-sm text-gray-400'>Имя:</label>
				<input id='editName' value='${u.name || ''}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Новый пароль:</label>
				<input id='editPass' type='password' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<div class='flex items-center gap-2 mb-3'>
					<input id='editIsAdmin' type='checkbox' ${u.is_admin ? 'checked' : ''}>
					<label class='text-sm'>Администратор</label>
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

function deleteUser(name) {
	if (!confirm(`Удалить ${name}?`)) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'delete_user', username: name }) })
		.then(() => location.reload());
}

// === Инициализация ===
loadUsers();