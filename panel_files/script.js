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