<div id="modal-bg" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
	<div id="modal-content" class="bg-gray-800 p-6 rounded-xl w-96 relative shadow-lg border border-gray-700">
		<!-- контент модального окна вставляется JS -->
	</div>
</div>

<script>
// === Универсальная функция закрытия модального окна ===
function closeModal() {
	document.getElementById('modal-bg').classList.add('hidden');
}

// === Открытие модалки для добавления колонки ===
function openAddColumn() {
	document.getElementById('modal-bg').classList.remove('hidden');
	document.getElementById('modal-content').innerHTML = `
		<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
		<h2 class='text-xl mb-4 font-semibold text-center'>Добавить колонку</h2>

		<label class='block mb-1 text-sm text-gray-400'>Название колонки:</label>
		<input id='colName' placeholder='Например: В работе' class='w-full mb-3 p-2 rounded bg-gray-700'>

		<label class='block mb-1 text-sm text-gray-400'>Цвет заголовка:</label>
		<input id='colBg' type='color' value='#374151' class='w-full mb-3 h-10 rounded'>

		<label class='block mb-1 text-sm text-gray-400'>Цвет задач в колонке:</label>
		<input id='taskBg' type='color' value='#1f2937' class='w-full mb-3 h-10 rounded'>

		<label class='flex items-center gap-2 mb-3'>
			<input id='autoComplete' type='checkbox' class='rounded'>
			<span class='text-sm'>Автоматически завершать задачи в этой колонке</span>
		</label>

		<label class='flex items-center gap-2 mb-3'>
			<input id='timer' type='checkbox' class='rounded'>
			<span class='text-sm'>Таймер (время в колонке)</span>
		</label>

		<div class="flex gap-2">
			<button onclick='saveColumn()' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Сохранить</button>
			<button onclick='closeModal()' class='flex-1 bg-gray-600 hover:bg-gray-500 p-2 rounded'>Отмена</button>
		</div>
	`;
}

// === Открытие модалки для добавления задачи ===
function openAddTask() {
	let respOptions = users.map(u => `<option value='${u.username}'>${u.name}</option>`).join('');
	document.getElementById('modal-bg').classList.remove('hidden');
	document.getElementById('modal-content').innerHTML = `
		<button onclick="closeModal()" class="absolute right-3 top-3 text-gray-400 hover:text-gray-200 text-lg">✖</button>
		<h2 class='text-xl mb-4 font-semibold text-center'>Новая задача</h2>

		<label class='block mb-1 text-sm text-gray-400'>Заголовок задачи:</label>
		<input id='title' placeholder='Например: Подготовить отчёт' class='w-full mb-3 p-2 rounded bg-gray-700'>

		<label class='block mb-1 text-sm text-gray-400'>Описание:</label>
		<textarea id='desc' placeholder='Описание задачи' class='w-full mb-3 p-2 rounded bg-gray-700'></textarea>

		<label class='block mb-1 text-sm text-gray-400'>Исполнитель:</label>
		<select id='resp' class='w-full mb-3 p-2 rounded bg-gray-700'>${respOptions}</select>

		<label class='block mb-1 text-sm text-gray-400'>Срок выполнения:</label>
		<input id='deadline' type='date' class='w-full mb-3 p-2 rounded bg-gray-700'>

		<label class='block mb-1 text-sm text-gray-400'>Степень важности:</label>
		<select id='imp' class='w-full mb-3 p-2 rounded bg-gray-700'>
			<option value='не срочно'>🟩 Не срочно</option>
			<option value='средне'>🟨 Средне</option>
			<option value='срочно'>🟥 Срочно</option>
		</select>

		<label class='block mb-1 text-sm text-gray-400'>Поместить в колонку:</label>
		<select id='col' class='w-full mb-4 p-2 rounded bg-gray-700'>
			<?php
			$res = $db->query("SELECT * FROM columns");
			while ($r = $res->fetchArray(SQLITE3_ASSOC))
				echo "<option value='{$r['id']}'>{$r['name']}</option>";
			?>
		</select>

		<div class="flex gap-2">
			<button onclick='saveTask()' class='flex-1 bg-blue-600 hover:bg-blue-500 p-2 rounded'>Создать</button>
			<button onclick='closeModal()' class='flex-1 bg-gray-600 hover:bg-gray-500 p-2 rounded'>Отмена</button>
		</div>
	`;
}
</script>