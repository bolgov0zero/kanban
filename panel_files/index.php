<?php
date_default_timezone_set('Europe/Moscow');
session_start();
if (!isset($_SESSION['user'])) { header('Location: auth.php'); exit; }

$db = new SQLite3('/data/db.sqlite');
$user = $_SESSION['user'];
$isAdmin = $_SESSION['is_admin'] ?? 0;

// автоархив через 1 час
$tasks = $db->query("SELECT t.*, COALESCE(u.name, t.responsible) AS responsible_name FROM tasks t LEFT JOIN users u ON t.responsible = u.username WHERE completed = 1");
while ($t = $tasks->fetchArray(SQLITE3_ASSOC)) {
	if (time() - strtotime($t['created_at']) > 3600) {
		$stmt = $db->prepare("INSERT INTO archive (title, description, responsible, responsible_name, deadline, importance, archived_at)
			VALUES (:t,:d,:r,:rn,:dl,:i,:a)");
		foreach([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v)
			$stmt->bindValue($k, $t[$v]);
		$stmt->bindValue(':rn', $t['responsible_name']);
		$stmt->bindValue(':a', date('Y-m-d H:i:s'));
		$stmt->execute();
		$db->exec("DELETE FROM tasks WHERE id={$t['id']}");
	}
}

// Получаем имена всех пользователей
$userNames = [];
$resUsers = $db->query("SELECT username, name FROM users");
while ($u = $resUsers->fetchArray(SQLITE3_ASSOC)) {
	$userNames[$u['username']] = $u['name'] ?: $u['username'];
}
$user_name = $userNames[$user] ?? $user; // Имя текущего пользователя
$columns = $db->query("SELECT * FROM columns");

// Чтение версии из version.json
$versionData = [];
if (file_exists('version.json')) {
	$versionData = json_decode(file_get_contents('version.json'), true);
}
$version = $versionData['version'] ?? 'unknown';
?>
<!DOCTYPE html>
<html lang="ru" class="dark">
<head>
<meta charset="UTF-8"><title>Kanban</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="script.js" defer></script>
<style>
.drop-hover{outline:2px dashed #3b82f6;outline-offset:-4px;}
.task-card{margin-bottom:0.5rem;}
.tag{font-size:0.75rem;padding:2px 6px;border-radius:6px;width:auto;display:inline-flex;align-items:center;gap:0.25rem;}
.user-tag { background: rgba(55, 138, 179, 1); color: #fff; }
.icon-btn{cursor:pointer;transition:0.2s;}
.icon-btn:hover{transform:scale(1.2);}
.timer-tag { background: rgba(180, 22, 22, 0.8); color: #fff; }
.username-tag{background: rgba(39, 134, 195, 0.8);color: #ddd;font-size:1.15rem;padding:2px 6px;border-radius:6px;width:auto;display:inline-flex;align-items:center;gap:0.25rem;}
</style>
</head>
<body class="bg-gray-900 text-gray-100 p-4 min-h-screen flex flex-col">
<div class="flex justify-between mb-4 items-center">
	<h1 class="text-2xl font-semibold">Kanban-доска</h1>
	<div class="flex gap-2 items-center">
		<span class="username-tag"><?=htmlspecialchars($user_name)?></span>
		<?php if ($isAdmin): ?><button onclick="openUserSettings()" class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">⚙️ Настройки</button><?php endif; ?>
		<?php if ($isAdmin): ?><button onclick="openAddColumn()" class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">⬇️ Колонка</button><?php endif; ?>
		<button onclick="openAddTask()" class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">✅ Задача</button>
		<button onclick="openArchive()" class="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">📦 Архив</button>
		<a href="logout.php" class="bg-red-700 px-3 py-1 rounded hover:bg-red-600">Выйти</a>
	</div>
</div>
<main class="flex-1">
<div id="board" class="flex overflow-x-auto gap-4">
<?php while ($col=$columns->fetchArray(SQLITE3_ASSOC)): ?>
<div class="w-72 flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col"
	data-col-id="<?=$col['id']?>" data-task-color="<?=$col['task_color']?>" data-auto-complete="<?=$col['auto_complete']?>"
	ondrop="drop(event)" ondragover="allowDrop(event)" ondragenter="highlightDrop(this,true)" ondragleave="highlightDrop(this,false)">
	<div class="p-2 text-center rounded flex justify-between items-center mb-2"
		 style="background:<?=$col['bg_color']?>;color:<?=getContrastColor($col['bg_color'])?>;">
		<h2 class="font-semibold"><?=$col['name']?></h2>
		<?php if ($isAdmin): ?><button onclick="editColumn(<?=$col['id']?>)" class="text-sm opacity-75 hover:opacity-100">✏️</button><?php endif; ?>
	</div>

	<div class="flex-1" id="col<?=$col['id']?>">
	<?php
	$tq=$db->query("SELECT * FROM tasks WHERE column_id={$col['id']}");
	while($task=$tq->fetchArray(SQLITE3_ASSOC)):
	$colors=['не срочно'=>'bg-green-600','средне'=>'bg-yellow-500','срочно'=>'bg-red-600'];
	$tagColor=$colors[$task['importance']]??'bg-gray-600';
	$authorName = $userNames[$user] ?? $user;
	$respName = $userNames[$task['responsible']] ?? $task['responsible'];
	?>
	<div draggable="true" ondragstart="drag(event)" id="task<?=$task['id']?>" class="p-2 rounded cursor-move flex flex-col justify-between task-card"
		 style="background:<?=$col['task_color']?>;color:<?=getContrastColor($col['task_color'])?>;"
		 <?php if($col['timer'] && !empty($task['moved_at'])): ?>data-moved-at="<?= htmlspecialchars($task['moved_at']) ?>" data-timer-enabled="true"<?php endif; ?>>
		<div class="mb-2">
			<p class="text-[11px] text-gray-500 -mb-1 created-date" data-created="<?= htmlspecialchars($task['created_at']) ?>"></p>
			<div class="flex justify-between items-center mb-1">
				<p class="font-semibold"><?=$task['title']?></p>
				<button onclick="editTask(<?=$task['id']?>)" class="text-sm opacity-75 hover:opacity-100">✏️</button>
			</div>
			<p class="text-sm"><?php 
			$desc = htmlspecialchars($task['description'] ?? '');
			// Авто-линкование URL с сокращением (показываем только домен)
			$desc = preg_replace_callback('/(https?:\/\/[^\s<]+|www\.[^\s<]+)/i', function($matches) {
				$url = $matches[0];
				if (strpos($url, 'http') !== 0) $url = 'http://' . $url; // Добавляем http для www.
				$host = parse_url($url, PHP_URL_HOST);
				$short = $host ?: (strlen($url) > 30 ? substr($url, 0, 30) . '...' : $url);
				return '<a href="' . htmlspecialchars($url) . '" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">' . htmlspecialchars($short) . '</a>';
			}, $desc);
			// Переносы строк
			echo nl2br($desc);
			?></p>
		</div>
		<div class="flex flex-col gap-1 mt-2">
			<?php if (!empty($task['deadline'])): ?>
				<div class="w-fit"><span class="user-tag tag flex items-center gap-1 deadline-tag" data-deadline="<?= htmlspecialchars($task['deadline']) ?>">📅 <span class="deadline-text"></span></span></div>
			<?php endif; ?>
			<div class="flex justify-between items-center">
				<!-- Теги пользователей в двух строках, по ширине текста -->
				<div class="flex flex-col gap-1">
					<span class="user-tag tag flex items-center gap-1" title="Автор">👤 <?=htmlspecialchars($authorName)?></span>
					<span class="user-tag tag flex items-center gap-1" title="Исполнитель">🧑‍💻 <?=htmlspecialchars($respName)?></span>
				</div>
				<?php if($task['completed']): ?>
					<div class="flex gap-1 items-center">
						<span class="tag bg-blue-600 text-white">Завершено</span>
						<span class="icon-btn" onclick="archiveNow(<?=$task['id']?>)">📦</span>
					</div>
				<?php else: ?>
					<div class="flex flex-col items-end gap-1">
						<span class="tag <?=$tagColor?> text-white"><?=$task['importance']?></span>
						<?php if($col['timer'] && !empty($task['moved_at'])): ?>
							<span class="timer-tag tag flex items-center gap-1" id="timer-<?= $task['id'] ?>">⏱️ --:--:--</span>
						<?php endif; ?>
					</div>
				<?php endif; ?>
			</div>
		</div>
	</div>
	<?php endwhile; ?>
	</div>
</div>
<?php endwhile; ?>
</div>
</main>
<footer class="footer mt-auto bg-gray-800 text-gray-400 text-center py-4 text-sm rounded-t-lg rounded-b-lg">
	2025 © bolgov0zero | Версия: <?= htmlspecialchars($version) ?>
</footer>
<script>
var isAdmin = <?= $isAdmin ? 'true' : 'false' ?>;

// Функция для парсинга даты из Moscow timezone (UTC+3)
function parseMoscowDate(dateStr) {
  // dateStr в формате 'YYYY-MM-DD HH:MM:SS'
  const isoStr = dateStr.replace(' ', 'T') + '+03:00';
  return new Date(isoStr);
}

// Обновление дат создания задач (локальное время браузера)
function updateCreatedDates() {
  document.querySelectorAll('.created-date[data-created]').forEach(el => {
	const moscowDate = parseMoscowDate(el.getAttribute('data-created'));
	const options = { 
	  day: '2-digit', 
	  month: '2-digit', 
	  year: 'numeric', 
	  hour: '2-digit', 
	  minute: '2-digit',
	  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Локальный TZ браузера
	};
	el.textContent = moscowDate.toLocaleDateString('ru-RU', options);
  });
}

// Обновление дедлайнов (локальное время)
function updateDeadlines() {
  document.querySelectorAll('.deadline-tag[data-deadline]').forEach(el => {
	const deadlineStr = el.getAttribute('data-deadline'); // 'YYYY-MM-DD'
	const moscowDate = parseMoscowDate(deadlineStr + ' 00:00:00');
	const deadlineTextEl = el.querySelector('.deadline-text');
	if (deadlineTextEl) {
	  const options = { 
		day: '2-digit', 
		month: '2-digit', 
		year: 'numeric',
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
	  };
	  deadlineTextEl.textContent = moscowDate.toLocaleDateString('ru-RU', options);
	}
  });
}

// Динамический таймер (elapsed time, отображение в локальном формате, но diff универсален)
function updateTimers() {
  document.querySelectorAll('[data-timer-enabled="true"]').forEach(task => {
	const movedAtStr = task.getAttribute('data-moved-at');
	const taskId = task.id.replace('task', '');
	const timerEl = document.getElementById('timer-' + taskId);
	if (!timerEl || !movedAtStr) return;

	const moscowMovedDate = parseMoscowDate(movedAtStr);
	const now = new Date(); // Локальное время браузера
	const diff = now.getTime() - moscowMovedDate.getTime(); // ms, учитывая TZ при парсинге

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((diff % (1000 * 60)) / 1000);

	let timerStr = '';
	if (days > 0) timerStr += days + 'д ';
	timerStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

	timerEl.textContent = '⏱️ ' + timerStr;
  });
}

// Инициализация всех обновлений при загрузке
document.addEventListener('DOMContentLoaded', function() {
  updateCreatedDates();
  updateDeadlines();
  updateTimers();
});

// Запуск обновления таймера каждую секунду
setInterval(updateTimers, 1000);

// Если нужно обновлять даты/дедлайны динамически (например, при reload задач), вызовите функции снова
</script>
<?php include 'modals.php'; ?>
</body>
</html>
<?php
function getContrastColor($hex){
	if(!$hex)return"#fff";
	$hex=ltrim($hex,'#');
	if(strlen($hex)===3)$hex="{$hex[0]}{$hex[0]}{$hex[1]}{$hex[1]}{$hex[2]}{$hex[2]}";
	$r=hexdec(substr($hex,0,2));$g=hexdec(substr($hex,2,2));$b=hexdec(substr($hex,4,2));
	return(0.299*$r+0.587*$g+0.114*$b)>160?"#000":"#fff";
}
?>