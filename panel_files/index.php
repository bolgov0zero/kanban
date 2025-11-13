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
$user_name = $userNames[$user] ?? $user;

// Функция для получения аватара из имени с поддержкой кириллицы
function getAvatarFromName($name) {
	if (empty($name)) return '?';
	
	$words = explode(' ', trim($name));
	$initials = '';
	
	// Берем первую букву первого слова
	if (isset($words[0]) && !empty($words[0])) {
		// Для кириллицы используем mb_ функции, если доступны
		if (function_exists('mb_substr')) {
			$initials .= mb_strtoupper(mb_substr($words[0], 0, 1, 'UTF-8'), 'UTF-8');
		} else {
			// Фолбэк для серверов без mbstring
			$firstChar = substr($words[0], 0, 2); // Берем 2 байта для кириллицы
			$initials .= $firstChar;
		}
	}
	
	// Берем первую букву второго слова (если есть)
	if (isset($words[1]) && !empty($words[1])) {
		if (function_exists('mb_substr')) {
			$initials .= mb_strtoupper(mb_substr($words[1], 0, 1, 'UTF-8'), 'UTF-8');
		} else {
			$firstChar = substr($words[1], 0, 2);
			$initials .= $firstChar;
		}
	}
	
	return $initials ?: (function_exists('mb_substr') ? mb_strtoupper(mb_substr($name, 0, 1, 'UTF-8'), 'UTF-8') : substr($name, 0, 2));
}

// Получаем аватары для всех пользователей
$userAvatars = [];
foreach ($userNames as $username => $name) {
	$userAvatars[$username] = getAvatarFromName($name);
}

$columns = $db->query("SELECT * FROM columns");
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Kanban Board</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen flex flex-col">
<!-- Header -->
<header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
	<div class="flex items-center justify-between p-6">
		<div class="flex items-center gap-4">
			<div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
				<span class="text-white font-bold">K</span>
			</div>
			<h1 class="text-xl font-bold text-white">Kanban Доска</h1>
		</div>
		
		<div class="flex items-center gap-4">
			<!-- Action Buttons -->
			<div class="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
				<?php if ($isAdmin): ?>
				<button onclick="openUserSettings()" class="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-600" title="Настройки">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
					</svg>
				</button>
				<?php endif; ?>
				<button onclick="openAddColumn()" class="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-600" title="Добавить колонку">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
					</svg>
				</button>
				<button onclick="openAddTask()" class="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-600" title="Новая задача">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
					</svg>
				</button>
				<button onclick="openArchive()" class="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-600" title="Архив">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
					</svg>
				</button>
			</div>

			<!-- User Profile -->
			<div class="flex items-center gap-4">
				<div class="w-11 h-11 bg-gradient-to-r from-green-500 to-blue-500 ava-hed-style flex items-center justify-center text-white" title="<?= htmlspecialchars($user_name) ?>">
					<?= getAvatarFromName($user_name) ?>
				</div>
				<span class="text-gray-300"><?= htmlspecialchars($user_name) ?></span>
			</div>

			<a href="logout.php" class="btn-danger text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
				</svg>
				Выйти
			</a>
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="flex-1 p-6">
	<div id="board" class="flex gap-6 overflow-x-auto pb-6">
		<?php while ($col = $columns->fetchArray(SQLITE3_ASSOC)): ?>
		<div class="w-80 bg-gray-800 rounded-lg p-4"
			 data-col-id="<?= $col['id'] ?>"
			 data-col-bg="<?= $col['bg_color'] ?>"
			 data-task-color="<?= $col['task_color'] ?>" 
			 data-auto-complete="<?= $col['auto_complete'] ?>"
			 ondrop="drop(event)" 
			 ondragover="allowDrop(event)" 
			 ondragenter="highlightDrop(this,true)" 
			 ondragleave="highlightDrop(this,false)">
			
			<!-- Column Header -->
			<div class="column-header" style="background:<?= $col['bg_color'] ?>;color:<?= getContrastColor($col['bg_color']) ?>;">
				<div class="column-header-content">
					<h2 class="column-title"><?= $col['name'] ?></h2>
				</div>
				
				<span class="task-count"><?= $db->querySingle("SELECT COUNT(*) FROM tasks WHERE column_id={$col['id']}") ?></span>
				<button onclick="editColumn(<?= $col['id'] ?>)" class="column-edit-btn" title="Редактировать колонку">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
					</svg>
				</button>
			</div>

			<!-- Tasks Container -->
			<div class="min-h-200" id="col<?= $col['id'] ?>">
				<?php
				$tq = $db->query("SELECT * FROM tasks WHERE column_id={$col['id']}");
				while($task = $tq->fetchArray(SQLITE3_ASSOC)):
					$colors = ['не срочно' => 'bg-green-500', 'средне' => 'bg-yellow-500', 'срочно' => 'bg-red-500'];
					$tagColor = $colors[$task['importance']] ?? 'bg-gray-600';
					$authorName = $userNames[$user] ?? $user;
					$respName = $userNames[$task['responsible']] ?? $task['responsible'];
					$authorAvatar = $userAvatars[$user] ?? getAvatarFromName($user);
					$respAvatar = $userAvatars[$task['responsible']] ?? getAvatarFromName($task['responsible']);
					$textColor = getContrastColor('#FFFFFF'); // Фиксированный цвет для текста
				?>
				<div draggable="true" 
					 ondragstart="drag(event)" 
					 id="task<?= $task['id'] ?>" 
					 class="p-3 rounded cursor-move mb-3 task-card"
					 style="border-left-color:<?= $col['bg_color'] ?>;"
					 <?php if($col['timer'] && !empty($task['moved_at'])): ?>data-moved-at="<?= htmlspecialchars($task['moved_at']) ?>" data-timer-enabled="true"<?php endif; ?>
					
					<!-- Task Header -->
					<div class="mb-2">
						<p class="text-xs text-gray-500 -mb-1 created-date" data-created="<?= htmlspecialchars($task['created_at']) ?>"></p>
						<div class="flex justify-between items-start mb-1">
							<h3 class="font-semibold text-sm"><?= $task['title'] ?></h3>
							<button onclick="editTask(<?= $task['id'] ?>)" class="text-sm opacity-75 hover:opacity-100" title="Редактировать задачу">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
								</svg>
							</button>
						</div>
					</div>

					<!-- Task Description -->
					<div class="text-xs mb-3">
						<?php 
						$desc = $task['description'] ?? '';
						
						// Автолинкование URL
						$desc = preg_replace_callback('/(?<!\()\b(https?:\/\/[^\s<]+|www\.[^\s<]+)\b/i', function($m) {
							$url = $m[0];
							if (strpos($url, 'http') !== 0) $url = 'http://' . $url;
							$host = parse_url($url, PHP_URL_HOST);
							$short = $host ?: (strlen($url) > 30 ? substr($url, 0, 30) . '...' : $url);
							$short_esc = htmlspecialchars($short, ENT_QUOTES, 'UTF-8');
							$url_esc = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
							return '<a href="' . $url_esc . '" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">' . $short_esc . '</a>';
						}, $desc);
						
						// Markdown ссылки
						$desc = preg_replace_callback('/\[([^\[\]]+)\]\((https?:\/\/[^\s\)]+)\)/i', function($m) {
							$text = htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8');
							$url = htmlspecialchars($m[2], ENT_QUOTES, 'UTF-8');
							return '<a href="' . $url . '" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">' . $text . '</a>';
						}, $desc);
						
						// Переносы строк
						$desc = nl2br($desc, false);
						
						echo $desc;
						?>
					</div>

					<!-- Task Meta -->
					<div class="flex flex-col gap-2">
						<?php if (!empty($task['deadline'])): ?>
							<div class="w-fit">
								<span class="bg-red-500 bg-opacity-20 text-red-500 px-2 py-1 rounded text-xs deadline-tag" data-deadline="<?= htmlspecialchars($task['deadline']) ?>">
									📅 <span class="deadline-text"></span>
								</span>
							</div>
						<?php endif; ?>
						
						<div class="flex justify-between items-center">
							<!-- Users -->
							<div class="flex gap-2">
								<div class="ava-style w-9 h-7 bg-blue-500 flex items-center justify-center text-white text-xs" title="Автор: <?= htmlspecialchars($authorName) ?>">
									<?= $authorAvatar ?>
								</div>
								<div class="arrow">
									⇢
								</div>
								<div class="ava-style w-9 h-7 bg-green-500 flex items-center justify-center text-white text-xs" title="Исполнитель: <?= htmlspecialchars($respName) ?>">
									<?= $respAvatar ?>
								</div>
							</div>

							<!-- Status & Actions -->
							<div class="flex flex-col items-end gap-1">
								<?php if($task['completed']): ?>
									<div class="flex gap-1 items-center">
										<span class="bg-blue-600 text-white px-2 py-1 rounded text-xs">Завершено</span>
										<button onclick="archiveNow(<?= $task['id'] ?>)" class="text-sm hover:scale-110 transition-transform" title="Архивировать задачу">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
											</svg>
										</button>
									</div>
								<?php else: ?>
									<span class="<?= $tagColor ?> text-white px-2 py-1 rounded text-xs"><?= $task['importance'] ?></span>
									<?php if($col['timer'] && !empty($task['moved_at'])): ?>
										<span class="bg-red-600 bg-opacity-20 text-red-500 px-2 py-1 rounded text-xs" id="timer-<?= $task['id'] ?>">⏱️ --:--:--</span>
									<?php endif; ?>
								<?php endif; ?>
							</div>
						</div>
					</div>
				</div>
				<?php endwhile; ?>
			</div>
		</div>
		<?php endwhile; ?>
	</div>
</main>

<!-- Footer -->
<footer class="bg-gray-800 text-gray-400 text-center py-4 mt-auto">
	2025 © Болгов Иван
</footer>

<!-- Scripts -->
<script>
window.isAdmin = <?= json_encode($isAdmin) ?>;
</script>

<script src="script.js" defer></script>

<!-- Date & Time Scripts -->
<script>
function parseMoscowDate(dateStr) {
	const isoStr = dateStr.replace(' ', 'T') + '+03:00';
	return new Date(isoStr);
}

function updateCreatedDates() {
	document.querySelectorAll('.created-date[data-created]').forEach(el => {
		const moscowDate = parseMoscowDate(el.getAttribute('data-created'));
		const options = { 
			day: '2-digit', 
			month: '2-digit', 
			year: 'numeric', 
			hour: '2-digit', 
			minute: '2-digit',
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
		};
		el.textContent = moscowDate.toLocaleDateString('ru-RU', options);
	});
}

function updateDeadlines() {
	document.querySelectorAll('.deadline-tag[data-deadline]').forEach(el => {
		const deadlineStr = el.getAttribute('data-deadline');
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

function updateTimers() {
	document.querySelectorAll('[data-timer-enabled="true"]').forEach(task => {
		const movedAtStr = task.getAttribute('data-moved-at');
		const taskId = task.id.replace('task', '');
		const timerEl = document.getElementById('timer-' + taskId);
		if (!timerEl || !movedAtStr) return;

		const moscowMovedDate = parseMoscowDate(movedAtStr);
		const now = new Date();
		const diff = now.getTime() - moscowMovedDate.getTime();

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

document.addEventListener('DOMContentLoaded', function() {
	updateCreatedDates();
	updateDeadlines();
	updateTimers();
	setInterval(updateTimers, 1000);
});
</script>

<?php include 'modals.php'; ?>
</body>
</html>
<?php
function getContrastColor($hex){
	if(!$hex) return "#fff";
	$hex = ltrim($hex,'#');
	if(strlen($hex) === 3) $hex = "{$hex[0]}{$hex[0]}{$hex[1]}{$hex[1]}{$hex[2]}{$hex[2]}";
	$r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
	return (0.299*$r + 0.587*$g + 0.114*$b) > 160 ? "#000" : "#fff";
}
?>