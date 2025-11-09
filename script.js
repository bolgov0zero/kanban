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
function editColumn(id) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_column', id }) })
		.then(r => r.json())
		.then(c => {
			openModal(`  // <-- Используйте openModal вместо прямого innerHTML для consistency (если openModal определена)
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
					<input id='timer' type='checkbox' ${c.timer == 1 ? 'checked' : ''}>  // <-- Новое
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
			let respOptions = users.map(u => `<option value='${u.username}' ${t.responsible === u.username ? 'selected' : ''}>${u.name}</option>`).join('');
			openModal(`
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Редактировать задачу</h2>
				<label class='block mb-1 text-sm text-gray-400'>Заголовок:</label>
				<input id='title' value='${t.title}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Описание:</label>
				<textarea id='desc' class='w-full mb-3 p-2 rounded bg-gray-700'>${t.description}</textarea>
				<label class='block mb-1 text-sm text-gray-400'>Исполнитель:</label>
				<select id='resp' class='w-full mb-3 p-2 rounded bg-gray-700'>${respOptions}</select>
				<label class='block mb-1 text-sm text-gray-400'>Срок:</label>
				<input id='deadline' type='date' value='${t.deadline}' class='w-full mb-3 p-2 rounded bg-gray-700'>
				<label class='block mb-1 text-sm text-gray-400'>Важность:</label>
				<select id='imp' class='w-full mb-3 p-2 rounded bg-gray-700'>
					<option ${t.importance==='не срочно'?'selected':''}>не срочно</option>
					<option ${t.importance==='средне'?'selected':''}>средне</option>
					<option ${t.importance==='срочно'?'selected':''}>срочно</option>
				</select>
				<div class='flex gap-2'>
					<button onclick='updateTask(${id})' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
					<button onclick='deleteTask(${id})' class='flex-1 bg-red-700 hover:bg-red-600 p-2 rounded'>Удалить</button>
				</div>
			`);
		});
}

// === Модалка архива ===
function openArchive() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_archive' }) })
		.then(r => r.json())
		.then(d => {
			let html = `
				<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
				<h2 class='text-xl mb-4 font-semibold text-center'>Архивные задачи</h2>`;
			if (!d.length) html += `<p class='text-gray-400 text-center'>Архив пуст</p>`;
			else for (let t of d) {
				html += `
				<div class='bg-gray-700 p-3 rounded mb-3'>
					<p class='font-semibold mb-1 text-lg'>${t.title}</p>
					<p class='text-sm mb-2 text-gray-300'>${t.description}</p>
					<div class='flex justify-between text-xs text-gray-400'>
						<span>🧑‍💻 ${t.responsible_name || t.responsible}</span>
						<span>📅 ${t.deadline || '—'}</span>
					</div>
					<p class='text-xs text-gray-500 mt-1'>Архивировано: ${t.archived_at}</p>
					<button onclick='restore(${t.id})' class='bg-green-600 mt-3 px-3 py-1 rounded hover:bg-green-500'>Восстановить</button>
				</div>`;
			}
			// Кнопки в футере
			html += `<div class="flex gap-2 mt-4">
				<button onclick='closeModal()' class='flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded'>Закрыть</button>`;
			
			// Добавлена кнопка "Очистить" (только для админов; предполагаем, что isAdmin доступна глобально)
			if (typeof isAdmin !== 'undefined' && isAdmin) {
				html += `<button onclick='clearArchive()' class='flex-1 bg-red-600 hover:bg-red-500 py-2 rounded flex items-center justify-center gap-1'>
					🗑️ Очистить архив
				</button>`;
			}
			html += `</div>`;
			
			document.getElementById('modal-content').innerHTML = html;
			document.getElementById('modal-bg').classList.remove('hidden');
		});
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

// === Открытие модального окна настроек (улучшенная версия) ===
function openUserSettings() {
	// Загружаем пользователей
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(users => {
			// Генерируем список пользователей с улучшенным видом
			let userList = users.map(u => {
				const adminIcon = u.is_admin ? '👑' : '👤';
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

			// Загружаем Telegram настройки
			fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) })
				.then(r => r.json())
				.then(tg => {
					// HTML с вкладками для компактности
					const modalHTML = `
						<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg transition-colors">✖</button>
						
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-xl font-semibold">⚙️ Настройки</h2>
						</div>

						<!-- Вкладки -->
						<div class="flex mb-4 border-b border-gray-700">
							<button id="tab-users" class="flex-1 py-2 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-300 bg-gray-700/50">Пользователи</button>
							<button id="tab-telegram" class="flex-1 py-2 px-4 text-sm font-medium text-gray-400 hover:text-gray-200 bg-gray-800/50">Telegram</button>
						</div>

						<!-- Контент вкладки "Пользователи" -->
						<div id="content-users" class="space-y-3 mb-4">
							<div class="max-h-48 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800/50">
								${userList || '<p class="text-gray-400 text-center py-4">Нет пользователей</p>'}
							</div>
							
							<!-- Компактная форма добавления -->
							<div class="grid grid-cols-1 gap-2 p-3 bg-gray-700/30 rounded-lg">
								<input id="newUser" placeholder="Логин" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<input id="newName" placeholder="Имя" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<input id="newPass" type="password" placeholder="Пароль" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-blue-500">
								<label class="flex items-center gap-2 text-xs text-gray-300">
									<input id="newIsAdmin" type="checkbox" class="rounded">
									Админ
								</label>
								<button onclick="addUser()" class="bg-blue-600 hover:bg-blue-500 text-sm py-2 rounded transition-colors">➕ Добавить</button>
							</div>
						</div>

						<!-- Контент вкладки "Telegram" (скрыт по умолчанию) -->
						<div id="content-telegram" class="hidden space-y-3">
							<div class="grid grid-cols-1 gap-2 p-3 bg-gray-700/30 rounded-lg">
								<input id="tgToken" value="${tg.bot_token || ''}" placeholder="Bot Token" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
								<input id="tgChat" value="${tg.chat_id || ''}" placeholder="Chat ID" class="p-2 rounded bg-gray-600 text-sm border border-gray-600 focus:border-green-500">
								<div class="flex gap-2 pt-2">
									<button onclick="saveTelegram()" class="flex-1 bg-green-600 hover:bg-green-500 text-sm py-2 rounded transition-colors">💾 Сохранить</button>
									<button onclick="testTelegram()" class="flex-1 bg-blue-600 hover:bg-blue-500 text-sm py-2 rounded transition-colors">🧪 Тест</button>
								</div>
							</div>
						</div>

						<!-- Кнопка закрытия -->
						<button onclick="closeModal()" class="w-full bg-gray-600 hover:bg-gray-500 text-sm py-2 rounded transition-colors mt-4">Закрыть</button>
					`;

					document.getElementById('modal-content').innerHTML = modalHTML;
					document.getElementById('modal-content').className = 'bg-gray-800 p-6 rounded-xl w-[35rem] relative shadow-lg border border-gray-700'; // Устанавливаем ширину 35rem
					document.getElementById('modal-bg').classList.remove('hidden');

					// JS для переключения вкладок
					document.getElementById('tab-users').onclick = () => {
						document.getElementById('content-users').classList.remove('hidden');
						document.getElementById('content-telegram').classList.add('hidden');
						document.getElementById('tab-users').classList.add('border-blue-500', 'text-blue-300', 'bg-gray-700/50');
						document.getElementById('tab-users').classList.remove('text-gray-400', 'bg-gray-800/50');
						document.getElementById('tab-telegram').classList.remove('border-blue-500', 'text-blue-300', 'bg-gray-700/50');
						document.getElementById('tab-telegram').classList.add('text-gray-400', 'bg-gray-800/50');
					};

					document.getElementById('tab-telegram').onclick = () => {
						document.getElementById('content-users').classList.add('hidden');
						document.getElementById('content-telegram').classList.remove('hidden');
						document.getElementById('tab-telegram').classList.add('border-blue-500', 'text-blue-300', 'bg-gray-700/50');
						document.getElementById('tab-telegram').classList.remove('text-gray-400', 'bg-gray-800/50');
						document.getElementById('tab-users').classList.remove('border-blue-500', 'text-blue-300', 'bg-gray-700/50');
						document.getElementById('tab-users').classList.add('text-gray-400', 'bg-gray-800/50');
					};
				});
		});
}

// === Telegram ===
function saveTelegram() {
	let data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: document.getElementById('tgToken').value,
		chat_id: document.getElementById('tgChat').value
	});
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success ? 'Сохранено!' : 'Ошибка сохранения'));
}

function testTelegram() {
	let data = new URLSearchParams({ action: 'test_telegram' });
	fetch('api.php', { method: 'POST', body: data })
		.then(r => r.json())
		.then(res => alert(res.success || res.error || 'Ошибка'));
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