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
		timer: document.getElementById('timer').checked ? 1 : 0  // <-- Новое
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
		timer: document.getElementById('timer').checked ? 1 : 0  // <-- Новое
	});
	fetch('api.php', { method: 'POST', body: data }).then(() => location.reload());
}
function deleteColumn(id) {
	if (!confirm('Удалить колонку и все задачи в ней?')) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'delete_column', id }) })
		.then(() => location.reload());
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

// === Новая функция: Очистить архив ===
function clearArchive() {
	if (!confirm('Удалить ВСЕ задачи из архива? Это действие необратимо!')) return;
	fetch('api.php', { 
		method: 'POST', 
		body: new URLSearchParams({ action: 'clear_archive' }) 
	})
	.then(r => r.json())
	.then(res => {
		if (res.success) {
			alert('Архив очищен!');
			closeModal();
			// Перезагрузи страницу, если нужно обновить счётчик или что-то
			location.reload();
		} else {
			alert('Ошибка очистки: ' + (res.error || 'Неизвестная ошибка'));
		}
	})
	.catch(err => alert('Ошибка сети: ' + err));
}

function restore(id) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'restore_task', id }) })
		.then(() => location.reload());
}
function archiveNow(id) {
	if (!confirm('Отправить в архив?')) return;
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'archive_now', id }) })
		.then(() => location.reload());
}

// === Модальное окно ===
function openModal(html) {
	document.getElementById('modal-bg').classList.remove('hidden');
	document.getElementById('modal-content').innerHTML = html;
}
function closeModal() { document.getElementById('modal-bg').classList.add('hidden'); }



// === Telegram ===
function saveTelegram() {
	let data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: document.getElementById('tgToken').value,
		chat_id: document.getElementById('tgChat').value,
		timer_threshold: document.getElementById('tgThreshold').value || 60
	});
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Сохранено!' : 'Ошибка: ' + (res.message || 'неизвестно')));
}

function testTelegram() {
	let data = new URLSearchParams({ action: 'test_telegram' });
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => {
			if (res.success) {
				alert('✅ ' + res.message);
			} else {
				alert('❌ ' + res.message);
			}
		})
		.catch(err => {
			console.error('Ошибка теста Telegram:', err);
			alert('Ошибка сети или сервера. Проверьте консоль.');
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

// === Настройки пользователей + Telegram + Уведомления ===
function openUserSettings() {
	if (!isAdmin) return alert('Доступ запрещён');

	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(users => {
			const userList = users.map(u => {
				const adminIcon = u.is_admin ? 'Admin' : 'User';
				const delBtn = u.username !== 'user1' ? 
					`<button class="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded transition-colors" onclick="deleteUser('${u.username}')">Удалить</button>` : '';
				return `
					<div class="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg mb-2 hover:bg-gray-700 transition-colors">
						<div class="flex items-center gap-2">
							<span class="text-lg">${adminIcon}</span>
							<div>
								<p class="font-medium text-gray-100">${u.name || u.username}</p>
								<p class="text-xs text-gray-400">${u.username}</p>
							</div>
						</div>
						<div class="flex gap-1">
							<button class="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded transition-colors" onclick="editUser('${u.username}')">Редактировать</button>
							${delBtn}
						</div>
					</div>
				`;
			}).join('');

			fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) })
				.then(r => r.json())
				.then(tg => {
					const threshold = tg.timer_threshold || 60;
					const modalHTML = `
						<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg transition-colors">X</button>
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-semibold">Настройки</h2>
						</div>

						<!-- Вкладки -->
						<div class="flex mb-4 border-b border-gray-700">
							<button id="tab-users" class="flex-1 py-2 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-300 bg-gray-700/50">Пользователи</button>
							<button id="tab-telegram" class="flex-1 py-2 px-4 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50">Telegram</button>
							<button id="tab-notifications" class="flex-1 py-2 px-4 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50">Уведомления</button>
						</div>

						<!-- Вкладка: Пользователи -->
						<div id="content-users" class="space-y-3 mb-4">
							<div class="max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800/50">
								${userList || '<p class="text-gray-400 text-center py-4">Нет пользователей</p>'}
							</div>
							<div class="grid grid-cols-1 gap-2 p-3 bg-gray-700/30 rounded-lg">
								<input id="newUser" placeholder="Логин" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<input id="newName" placeholder="Имя" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<input id="newPass" type="password" placeholder="Пароль" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<label class="flex items-center gap-2 text-xs text-gray-300">
									<input id="newIsAdmin" type="checkbox" class="rounded"> Админ
								</label>
								<button onclick="addUser()" class="bg-blue-600 hover:bg-blue-500 text-sm py-2 rounded transition-colors">Добавить</button>
							</div>
						</div>

						<!-- Вкладка: Telegram -->
						<div id="content-telegram" class="hidden space-y-3">
							<div class="grid grid-cols-1 gap-2 p-3 bg-gray-700/30 rounded-lg">
								<input id="tgToken" value="${tg.bot_token || ''}" placeholder="Bot Token" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
								<input id="tgChat" value="${tg.chat_id || ''}" placeholder="Chat ID" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
								<div class="flex gap-2 pt-2">
									<button onclick="saveTelegram()" class="flex-1 bg-green-600 hover:bg-green-500 text-sm py-2 rounded transition-colors">Сохранить</button>
									<button onclick="testTelegram()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-sm py-2 rounded transition-colors">Тест</button>
								</div>
							</div>
						</div>

						<!-- Вкладка: Уведомления -->
						<div id="content-notifications" class="hidden space-y-3">
							<div class="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
								<p class="text-sm text-yellow-300 mb-2">Уведомление отправляется, когда задача находится в колонке с таймером дольше указанного времени.</p>
							</div>
							<div class="grid grid-cols-1 gap-2 p-3 bg-gray-700/30 rounded-lg">
								<label class="text-sm text-gray-300">Через сколько <b>минут</b> присылать уведомление?</label>
								<input id="timerThreshold" type="number" min="1" value="${threshold}" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-yellow-500">
								<div class="text-xs text-gray-400 mt-1">Например: 1, 30, 60, 1440 (24 часа)</div>
								<button onclick="saveTimerThreshold()" class="bg-yellow-600 hover:bg-yellow-500 text-sm py-2 rounded transition-colors mt-2">Сохранить порог</button>
							</div>
						</div>

						<button onclick="closeModal()" class="w-full bg-gray-600 hover:bg-gray-500 text-sm py-2 rounded transition-colors mt-4">Закрыть</button>
					`;

					openModal(modalHTML);
					document.getElementById('modal-content').className = 'bg-gray-800 p-6 rounded-xl w-[38rem] relative shadow-lg border border-gray-700';

					// === Обработчики вкладок ===
					const setActiveTab = (activeId, contentId) => {
						['users', 'telegram', 'notifications'].forEach(id => {
							const tab = document.getElementById(`tab-${id}`);
							const content = document.getElementById(`content-${id}`);
							if (id === activeId) {
								tab.className = 'flex-1 py-2 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-300 bg-gray-700/50';
								content.classList.remove('hidden');
							} else {
								tab.className = 'flex-1 py-2 px-4 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50';
								content.classList.add('hidden');
							}
						});
					};

					document.getElementById('tab-users').onclick = () => setActiveTab('users', 'content-users');
					document.getElementById('tab-telegram').onclick = () => setActiveTab('telegram', 'content-telegram');
					document.getElementById('tab-notifications').onclick = () => setActiveTab('notifications', 'content-notifications');
				});
		});
}

// === Сохранение порога таймера ===
function saveTimerThreshold() {
	const threshold = document.getElementById('timerThreshold').value;
	if (!threshold || threshold < 1) return alert('Введите число больше 0');

	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({
			action: 'save_timer_threshold',
			timer_threshold: threshold
		})
	})
	.then(r => r.json())
	.then(res => {
		alert(res.success ? `Уведомления будут приходить через ${threshold} мин.` : 'Ошибка');
	});
}