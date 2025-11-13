// Глобальные переменные
let users = [];
let columns = [];
let links = [];
let currentEditId = null;

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

	// Немедленно применяем стили - белый фон и цвет корешка из колонки
	let colBg = ev.currentTarget.dataset.colBg || '#374151';
	let txt = getContrastColor('#FFFFFF');
	
	// Сразу применяем стили
	task.style.background = '#FFFFFF';
	task.style.color = txt;
	task.style.borderLeftColor = colBg;

	ev.currentTarget.classList.remove('drop-hover');

	// Отправляем запрос на сервер и обновляем страницу
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'move_task', task_id: taskId, column_id: colId })
	}).then(() => {
		location.reload(); // Обновляем страницу для применения всех изменений
	});
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

function loadUsers() {
	return fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_users' }) })
		.then(r => r.json())
		.then(data => { 
			users = data;
			window.users = data; // Обновляем глобальную переменную
			return data; 
		})
		.catch(err => console.error('Error loading users:', err));
}

function loadColumns() {
	return fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_columns' }) })
		.then(r => r.json())
		.then(data => { 
			columns = data;
			window.columns = data; // Обновляем глобальную переменную
			return data; 
		})
		.catch(err => console.error('Error loading columns:', err));
}

function loadLinks() {
	return fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_links' }) })
		.then(r => r.json())
		.then(data => { links = data; return data; })
		.catch(err => console.error('Error loading links:', err));
}

// Загрузка при старте
document.addEventListener('DOMContentLoaded', function() {
	loadUsers();
	loadColumns();
	loadLinks();
});

function openModal(html) {
	const modalBg = document.getElementById('modal-bg');
	const modalContent = document.getElementById('modal-content');
	
	if (!modalBg || !modalContent) {
		console.error('Modal elements not found');
		return;
	}
	
	modalContent.innerHTML = html;
	modalBg.classList.remove('hidden');
	
	// Перепривязываем обработчики для кнопок ссылок
	setTimeout(() => {
		const linkPickerBtns = modalContent.querySelectorAll('.link-picker-btn');
		linkPickerBtns.forEach(btn => {
			btn.onclick = openLinkPicker;
		});
	}, 100);
	
	// Добавляем обработчик Escape для закрытия
	const handleEscape = (e) => {
		if (e.key === 'Escape') {
			closeModal();
		}
	};
	
	document.addEventListener('keydown', handleEscape);
	modalBg._escapeHandler = handleEscape;
	
	// Фокусируемся на первом инпуте
	const firstInput = modalContent.querySelector('input, textarea, select');
	if (firstInput) {
		setTimeout(() => firstInput.focus(), 100);
	}
	
	// Предотвращаем прокрутку body при открытой модалке
	document.body.style.overflow = 'hidden';
}

function closeModal() {
	const modalBg = document.getElementById('modal-bg');
	if (modalBg) {
		modalBg.classList.add('hidden');
		currentEditId = null;
		
		// Убираем обработчик Escape
		if (modalBg._escapeHandler) {
			document.removeEventListener('keydown', modalBg._escapeHandler);
		}
	}
	
	// Восстанавливаем прокрутку body
	document.body.style.overflow = '';
}

function closeLinkPicker() {
	const linkPicker = document.getElementById('link-picker');
	if (linkPicker) {
		linkPicker.classList.add('hidden');
	}
}

// === Колонки ===
function openAddColumn() {
	const template = document.getElementById('add-column-modal-template');
	if (template) {
		openModal(template.innerHTML);
		
		// Настройка обновления цветов
		setTimeout(() => {
			setupColorInputs('colBg', 'colBgValue');
			setupColorInputs('taskBg', 'taskBgValue');
		}, 100);
	}
}

function editColumn(id) {
	currentEditId = id;
	
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_column', id }) })
		.then(r => r.json())
		.then(c => {
			if (!c) {
				alert('Колонка не найдена');
				return;
			}
			
			const template = document.getElementById('edit-column-modal-template');
			if (template) {
				openModal(template.innerHTML);
				
				// Заполняем данные после открытия модалки
				setTimeout(() => {
					fillColumnForm(c);
				}, 100);
			}
		})
		.catch(err => {
			console.error('Error loading column:', err);
			alert('Ошибка при загрузке колонки');
		});
}

function setupColorInputs(inputId, valueId) {
	const colorInput = document.getElementById(inputId);
	const valueElement = document.getElementById(valueId);
	
	if (colorInput && valueElement) {
		colorInput.addEventListener('input', function(e) {
			valueElement.textContent = e.target.value;
		});
	}
}

function saveColumn() {
	const name = document.getElementById('colName')?.value;
	
	if (!name) {
		alert('Введите название колонки');
		return;
	}
	
	let data = new URLSearchParams({
		action: 'add_column',
		name: name,
		bg_color: document.getElementById('colBg')?.value || '#374151',
		auto_complete: document.getElementById('autoComplete')?.checked ? 1 : 0,
		timer: document.getElementById('timer')?.checked ? 1 : 0
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при создании колонки');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при создании колонки');
	});
}

function fillColumnForm(column) {
	const nameInput = document.getElementById('editColName');
	const colBgInput = document.getElementById('editColBg');
	const colBgValue = document.getElementById('editColBgValue');
	const autoCompleteInput = document.getElementById('editAutoComplete');
	const timerInput = document.getElementById('editTimer');
	
	if (nameInput) nameInput.value = column.name || '';
	if (colBgInput) {
		colBgInput.value = column.bg_color || '#FFFFFF';
		if (colBgValue) colBgValue.textContent = column.bg_color || '#FFFFFF';
	}
	if (autoCompleteInput) autoCompleteInput.checked = column.auto_complete == 1;
	if (timerInput) timerInput.checked = column.timer == 1;
	
	// Настройка обновления цвета в реальном времени
	setupColorInputs('editColBg', 'editColBgValue');
}

function updateColumn() {
	if (!currentEditId) return;
	
	const name = document.getElementById('editColName')?.value;
	
	if (!name) {
		alert('Введите название колонки');
		return;
	}
	
	let data = new URLSearchParams({
		action: 'update_column',
		id: currentEditId,
		name: name,
		bg_color: document.getElementById('editColBg')?.value || '#374151',
		auto_complete: document.getElementById('editAutoComplete')?.checked ? 1 : 0,
		timer: document.getElementById('editTimer')?.checked ? 1 : 0
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при обновлении колонки');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при обновлении колонки');
	});
}

// Новая система вкладок для настроек
function fillSettingsData(usersData, tgData, linksData) {
	// Заполняем список пользователей
	const usersList = document.getElementById('users-list');
	if (usersList) {
		usersList.innerHTML = usersData.map(u => `
			<div class="user-card">
				<div class="user-info">
					<div class="user-avatar-medium">${getAvatarFromName(u.name || u.username)}</div>
					<div class="user-details">
						<div class="user-username">${u.username}</div>
						<div class="user-name">${u.name || 'Без имени'}</div>
					</div>
				</div>
				<div class="user-actions">
					${u.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
					<button onclick="editUserSettings('${u.username}')" class="user-action-btn user-edit-btn" title="Редактировать">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
					</button>
					<button onclick="deleteUser('${u.username}')" class="user-action-btn user-delete-btn" title="Удалить">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</div>
		`).join('');
		
		// Обновляем счетчик пользователей
		const usersCount = document.getElementById('users-count');
		if (usersCount) {
			usersCount.textContent = usersData.length + ' пользователей';
		}
	}

	// Заполняем список ссылок
	const linksList = document.getElementById('admin-links-list');
	if (linksList) {
		linksList.innerHTML = linksData.map(l => `
			<div class="link-card">
				<div class="link-info">
					<div class="link-name">${l.name}</div>
					<div class="link-url">${l.url}</div>
				</div>
				<div class="user-actions">
					<button onclick="deleteLink(${l.id})" class="user-action-btn user-delete-btn" title="Удалить">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</div>
		`).join('');
		
		// Обновляем счетчик ссылок
		const linksCount = document.getElementById('links-count');
		if (linksCount) {
			linksCount.textContent = linksData.length + ' ссылок';
		}
	}

	// Заполняем Telegram настройки
	const tgToken = document.getElementById('tgToken');
	const tgChat = document.getElementById('tgChat');
	if (tgToken) tgToken.value = tgData.bot_token || '';
	if (tgChat) tgChat.value = tgData.chat_id || '';
}

// Инициализация вкладок настроек
function initSettingsTabs() {
	const menuItems = document.querySelectorAll('.settings-menu-item');
	const tabContents = document.querySelectorAll('.tab-content');
	
	menuItems.forEach(item => {
		item.addEventListener('click', function() {
			const tabName = this.getAttribute('data-tab');
			
			if (!tabName) return;
			
			// Убираем активный класс у всех
			menuItems.forEach(i => i.classList.remove('active'));
			tabContents.forEach(tab => tab.classList.remove('active'));
			
			// Добавляем активный класс текущему
			this.classList.add('active');
			const targetTab = document.getElementById(tabName + '-tab');
			if (targetTab) {
				targetTab.classList.add('active');
			}
		});
	});
}

function getAvatarFromName(name) {
	if (!name) return '?';
	
	const words = name.split(' ').filter(word => word.length > 0);
	let initials = '';
	
	if (words.length > 0) {
		initials += words[0].charAt(0).toUpperCase();
	}
	if (words.length > 1) {
		initials += words[1].charAt(0).toUpperCase();
	}
	
	return initials || name.charAt(0).toUpperCase();
}

// Функция экспорта данных (заглушка)
function exportData() {
	alert('Функция экспорта данных будет реализована в будущем');
}

function deleteColumn() {
	if (!currentEditId) return;
	
	if (!confirm('Удалить колонку и все задачи в ней?')) return;
	
	fetch('api.php', { 
		method: 'POST', 
		body: new URLSearchParams({ action: 'delete_column', id: currentEditId }) 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при удалении колонки');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при удалении колонки');
	});
}

// === Задачи ===
function openAddTask(columnId = null) {
	const template = document.getElementById('add-task-modal-template');
	if (template) {
		openModal(template.innerHTML);
		
		// Заполняем данные после открытия модалки
		setTimeout(() => {
			fillTaskForm(null, columnId);
		}, 100);
	}
}

function editTask(id) {
	currentEditId = id;
	
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_task', id }) })
		.then(r => r.json())
		.then(task => {
			if (!task || !task.id) {
				alert('Задача не найдена');
				return;
			}
			
			const template = document.getElementById('edit-task-modal-template');
			if (template) {
				openModal(template.innerHTML);
				
				// Ждем полного рендеринга модального окна
				setTimeout(() => {
					fillEditTaskForm(task);
				}, 150);
			}
		})
		.catch(err => {
			console.error('Error loading task:', err);
			alert('Ошибка при загрузке задачи');
		});
}

// Новая функция специально для редактирования задачи
function fillEditTaskForm(task) {
	console.log('Filling edit form with:', task);
	
	// Заполняем основные поля
	const titleInput = document.getElementById('editTaskTitle');
	const descInput = document.getElementById('editTaskDesc');
	const deadlineInput = document.getElementById('editTaskDeadline');
	const impSelect = document.getElementById('editTaskImp');
	const respSelect = document.getElementById('editTaskResp');
	const colSelect = document.getElementById('editTaskCol');
	
	if (titleInput) titleInput.value = task.title || '';
	if (descInput) descInput.value = task.description || '';
	
	// Форматируем дату для input type="date"
	if (deadlineInput && task.deadline) {
		const date = new Date(task.deadline + 'T00:00:00');
		const formattedDate = date.toISOString().split('T')[0];
		deadlineInput.value = formattedDate;
	}
	
	if (impSelect) impSelect.value = task.importance || 'не срочно';
	
	// Заполняем исполнителей
	if (respSelect && window.users) {
		respSelect.innerHTML = window.users.map(u => 
			`<option value='${u.username}' ${u.username === task.responsible ? 'selected' : ''}>${u.name || u.username}</option>`
		).join('');
	}
	
	// Заполняем колонки
	if (colSelect && window.columns) {
		colSelect.innerHTML = window.columns.map(c => 
			`<option value='${c.id}' ${c.id == task.column_id ? 'selected' : ''}>${c.name}</option>`
		).join('');
	}
	
	console.log('Form filled successfully');
}

// Обновим также функцию fillTaskForm для создания задач
function fillTaskForm(task = null, defaultColumnId = null) {
	// Для создания задач используем старые ID полей
	const titleInput = document.getElementById('taskTitle');
	const descInput = document.getElementById('taskDesc');
	const deadlineInput = document.getElementById('taskDeadline');
	const impSelect = document.getElementById('taskImp');
	const respSelect = document.getElementById('taskResp');
	const colSelect = document.getElementById('taskCol');
	
	if (titleInput) titleInput.value = task ? task.title : '';
	if (descInput) descInput.value = task ? task.description : '';
	
	if (deadlineInput) {
		if (task && task.deadline) {
			const date = new Date(task.deadline + 'T00:00:00');
			deadlineInput.value = date.toISOString().split('T')[0];
		} else {
			deadlineInput.value = '';
		}
	}
	
	if (impSelect) impSelect.value = task ? task.importance : 'не срочно';
	
	// Заполняем исполнителей
	if (respSelect && window.users) {
		respSelect.innerHTML = window.users.map(u => 
			`<option value='${u.username}' ${(task && u.username === task.responsible) ? 'selected' : ''}>${u.name || u.username}</option>`
		).join('');
	}
	
	// Заполняем колонки
	if (colSelect && window.columns) {
		colSelect.innerHTML = window.columns.map(c => 
			`<option value='${c.id}' ${(task && c.id == task.column_id) || (!task && defaultColumnId == c.id) ? 'selected' : ''}>${c.name}</option>`
		).join('');
	}
}

function saveTask() {
	const title = document.getElementById('taskTitle')?.value;
	
	if (!title) {
		alert('Введите заголовок задачи');
		return;
	}
	
	let data = new URLSearchParams({
		action: 'add_task',
		title: title,
		description: document.getElementById('taskDesc')?.value || '',
		responsible: document.getElementById('taskResp')?.value || '',
		deadline: document.getElementById('taskDeadline')?.value || '',
		importance: document.getElementById('taskImp')?.value || 'не срочно',
		column_id: document.getElementById('taskCol')?.value || '1'
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при создании задачи');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при создании задачи');
	});
}

function updateTask() {
	if (!currentEditId) return;
	
	const title = document.getElementById('editTaskTitle')?.value;
	
	if (!title) {
		alert('Введите заголовок задачи');
		return;
	}
	
	let data = new URLSearchParams({
		action: 'update_task',
		id: currentEditId,
		title: title,
		description: document.getElementById('editTaskDesc')?.value || '',
		responsible: document.getElementById('editTaskResp')?.value || '',
		deadline: document.getElementById('editTaskDeadline')?.value || '',
		importance: document.getElementById('editTaskImp')?.value || 'не срочно'
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при обновлении задачи');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при обновлении задачи');
	});
}

function deleteTask() {
	if (!currentEditId) return;
	
	if (!confirm('Удалить задачу?')) return;
	
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'delete_task', id: currentEditId })
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при удалении задачи');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при удалении задачи');
	});
}

// === Архив ===
function openArchive() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_archive' }) })
		.then(r => r.json())
		.then(archive => {
			const template = document.getElementById('archive-modal-template');
			if (template) {
				let html = template.innerHTML;
				
				// Заменяем содержимое archive-list
				const archiveHTML = archive.length ? archive.map(t => `
					<div class="archive-item">
						<h4 class="archive-title">${t.title}</h4>
						<p class="archive-description">${t.description || ''}</p>
						<div class="archive-meta">
							<span>👤 ${t.responsible_name || t.responsible}</span>
							<button onclick="restore(${t.id})" class="restore-btn">Восстановить</button>
						</div>
					</div>
				`).join('') : '<p class="text-gray-400 text-center py-4">Архив пуст</p>';
				
				html = html.replace('<!-- Archive items will be inserted here -->', archiveHTML);
				
				// Скрываем кнопку очистки если не админ
				if (!window.isAdmin) {
					html = html.replace('<button onclick="clearArchive()" class="btn-danger">Очистить архив</button>', '');
				}
				
				openModal(html);
			}
		})
		.catch(err => {
			console.error('Error loading archive:', err);
			alert('Ошибка при загрузке архива');
		});
}

function restore(id) {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'restore_task', id }) })
		.then(() => location.reload())
		.catch(err => {
			console.error('Error restoring task:', err);
			alert('Ошибка при восстановлении задачи');
		});
}

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
			location.reload();
		} else {
			alert('Ошибка очистки: ' + (res.error || 'Неизвестная ошибка'));
		}
	})
	.catch(err => {
		console.error('Error clearing archive:', err);
		alert('Ошибка сети: ' + err);
	});
}

// === Настройки ===
function openUserSettings() {
	Promise.all([
		loadUsers(),
		fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_telegram_settings' }) }).then(r => r.json()),
		loadLinks()
	]).then(([usersData, tgData, linksData]) => {
		const template = document.getElementById('settings-modal-template');
		if (template) {
			openModal(template.innerHTML);
			
			// Заполняем данные и инициализируем вкладки
			setTimeout(() => {
				fillSettingsData(usersData, tgData, linksData);
				initSettingsTabs(); // Инициализируем вкладки после заполнения данных
			}, 100);
		}
	})
	.catch(err => {
		console.error('Error loading settings:', err);
		alert('Ошибка при загрузке настроек');
	});
}

// Редактирование пользователя в настройках
function editUserSettings(username) {
	currentEditId = username;
	
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_user', username }) })
		.then(r => r.json())
		.then(u => {
			const template = document.getElementById('edit-user-modal-template');
			if (template) {
				openModal(template.innerHTML);
				
				// Заполняем данные
				setTimeout(() => {
					const editUser = document.getElementById('editUser');
					const editName = document.getElementById('editName');
					const editIsAdmin = document.getElementById('editIsAdmin');
					
					if (editUser) editUser.value = u.username || '';
					if (editName) editName.value = u.name || '';
					if (editIsAdmin) editIsAdmin.checked = u.is_admin == 1;
				}, 100);
			}
		})
		.catch(err => {
			console.error('Error loading user:', err);
			alert('Ошибка при загрузке пользователя');
		});
}

function updateUser() {
	if (!currentEditId) return;
	
	let data = new URLSearchParams({
		action: 'update_user',
		username: currentEditId,
		name: document.getElementById('editName')?.value || '',
		is_admin: document.getElementById('editIsAdmin')?.checked ? 1 : 0
	});
	
	const password = document.getElementById('editPass')?.value;
	if (password) {
		data.append('password', password);
	}
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при обновлении пользователя');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при обновлении пользователя');
	});
}

function addUser() {
	const username = document.getElementById('newUser')?.value;
	const password = document.getElementById('newPass')?.value;
	
	if (!username || !password) {
		alert('Заполните логин и пароль');
		return;
	}
	
	let data = new URLSearchParams({
		action: 'add_user',
		username: username,
		password: password,
		name: document.getElementById('newName')?.value || '',
		is_admin: document.getElementById('newIsAdmin')?.checked ? 1 : 0
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при создании пользователя');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при создании пользователя');
	});
}

function deleteUser(username) {
	if (!confirm(`Удалить пользователя ${username}?`)) return;
	
	fetch('api.php', { 
		method: 'POST', 
		body: new URLSearchParams({ action: 'delete_user', username }) 
	})
	.then(response => {
		if (response.ok) {
			location.reload();
		} else {
			alert('Ошибка при удалении пользователя');
		}
	})
	.catch(err => {
		console.error('Error:', err);
		alert('Ошибка при удалении пользователя');
	});
}

function saveTelegram() {
	let data = new URLSearchParams({
		action: 'save_telegram_settings',
		bot_token: document.getElementById('tgToken')?.value || '',
		chat_id: document.getElementById('tgChat')?.value || ''
	});
	
	fetch('api.php', { 
		method: 'POST', 
		body: data 
	})
	.then(r => r.json())
	.then(res => alert(res.success ? 'Сохранено!' : 'Ошибка сохранения'))
	.catch(err => {
		console.error('Error saving telegram:', err);
		alert('Ошибка сохранения');
	});
}

function testTelegram() {
	fetch('api.php', { 
		method: 'POST', 
		body: new URLSearchParams({ action: 'test_telegram' }) 
	})
	.then(r => r.json())
	.then(res => alert(res.success ? 'Сообщение отправлено!' : 'Ошибка отправки'))
	.catch(err => {
		console.error('Error testing telegram:', err);
		alert('Ошибка отправки');
	});
}

// === Ссылки ===
function openLinkPicker() {
	const linkPicker = document.getElementById('link-picker');
	if (linkPicker) {
		linkPicker.classList.remove('hidden');
		loadLinksList();
	}
}

function loadLinksList() {
	fetch('api.php', { method: 'POST', body: new URLSearchParams({ action: 'get_links' }) })
		.then(r => r.json())
		.then(data => {
			const linksList = document.getElementById('links-list');
			if (linksList) {
				linksList.innerHTML = data.length ? data.map(l => `
					<div class="flex justify-between items-center p-1 hover:bg-gray-600 rounded">
						<span class="text-sm cursor-pointer text-blue-400 hover:underline" onclick="insertLink('${l.name}', '${l.url}')">${l.name}</span>
						<button onclick="deleteLink(${l.id})" class="text-red-400 text-xs">✖</button>
					</div>
				`).join('') : '<p class="text-gray-500 text-xs">Нет сохранённых ссылок</p>';
			}
		})
		.catch(err => console.error('Error loading links:', err));
}

function insertLink(name, url) {
	// Ищем активное текстовое поле в любой открытой модалке
	let desc = null;
	
	// Сначала проверяем модалку редактирования задачи
	desc = document.getElementById('editTaskDesc');
	if (!desc) {
		// Проверяем модалку создания задачи
		desc = document.getElementById('taskDesc');
	}
	
	if (!desc) {
		console.error('Could not find description textarea');
		return;
	}
	
	const start = desc.selectionStart;
	const end = desc.selectionEnd;
	const text = desc.value;
	const insert = `[${name}](${url})`;
	
	desc.value = text.slice(0, start) + insert + text.slice(end);
	desc.focus();
	desc.setSelectionRange(start + insert.length, start + insert.length);
	closeLinkPicker();
}

function saveLink() {
	const name = document.getElementById('linkName')?.value.trim();
	const url = document.getElementById('linkUrl')?.value.trim();
	
	if (!name || !url) {
		alert('Заполните имя и URL');
		return;
	}
	
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'add_link', name, url })
	})
	.then(() => {
		document.getElementById('linkName').value = '';
		document.getElementById('linkUrl').value = '';
		loadLinksList();
	})
	.catch(err => {
		console.error('Error saving link:', err);
		alert('Ошибка сохранения ссылки');
	});
}

function adminAddLink() {
	const name = document.getElementById('newLinkName')?.value.trim();
	const url = document.getElementById('newLinkUrl')?.value.trim();
	
	if (!name || !url) {
		alert('Заполните поля');
		return;
	}
	
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'add_link', name, url })
	})
	.then(() => {
		document.getElementById('newLinkName').value = '';
		document.getElementById('newLinkUrl').value = '';
		openUserSettings(); // Перезагружаем настройки
	})
	.catch(err => {
		console.error('Error adding link:', err);
		alert('Ошибка добавления ссылки');
	});
}

function deleteLink(id) {
	if (!confirm('Удалить ссылку?')) return;
	
	fetch('api.php', {
		method: 'POST',
		body: new URLSearchParams({ action: 'delete_link', id })
	})
	.then(() => {
		loadLinksList();
		// Если открыты настройки, обновляем их
		if (!document.getElementById('modal-bg').classList.contains('hidden')) {
			openUserSettings();
		}
	})
	.catch(err => {
		console.error('Error deleting link:', err);
		alert('Ошибка удаления ссылки');
	});
}

function archiveNow(id) {
	if (!confirm('Отправить в архив?')) return;
	
	fetch('api.php', { 
		method: 'POST', 
		body: new URLSearchParams({ action: 'archive_now', id }) 
	})
	.then(() => location.reload())
	.catch(err => {
		console.error('Error archiving task:', err);
		alert('Ошибка архивирования задачи');
	});
}