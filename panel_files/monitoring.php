<?php
// monitoring.php — фоновый мониторинг таймера
date_default_timezone_set('Europe/Moscow');
$db = new SQLite3('/data/db.sqlite');

$tg = $db->querySingle("SELECT bot_token, chat_id, timer_threshold FROM telegram_settings WHERE id=1", true);
$bot_token = $tg['bot_token'] ?? '';
$chat_id = $tg['chat_id'] ?? '';
$threshold_minutes = max(1, (int)($tg['timer_threshold'] ?? 60));
$threshold_seconds = $threshold_minutes * 60;

if (empty($bot_token) || empty($chat_id)) {
	exit("Telegram не настроен\n");
}

function sendTelegram($bot_token, $chat_id, $text) {
	$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
	$post = ['chat_id' => $chat_id, 'text' => $text, 'parse_mode' => 'HTML'];
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_TIMEOUT, 10);
	curl_exec($ch);
	curl_close($ch);
}

// Храним уже отправленные уведомления (id задачи + порог)
$sent = [];

while (true) {
	$now = time();
	$res = $db->query("SELECT t.id, t.title, t.moved_at, c.name AS col_name, u.name AS resp_name 
					   FROM tasks t 
					   JOIN columns c ON t.column_id = c.id 
					   LEFT JOIN users u ON t.responsible = u.username 
					   WHERE c.timer = 1 AND t.moved_at IS NOT NULL");

	while ($task = $res->fetchArray(SQLITE3_ASSOC)) {
		$moved = strtotime($task['moved_at']);
		$elapsed = $now - $moved;

		// Уведомление, если прошло больше порога и ещё не отправляли
		if ($elapsed >= $threshold_seconds && !in_array($task['id'], $sent)) {
			$title = $task['title'] ?? 'Без названия';
			$col = $task['col_name'] ?? 'Колонка';
			$resp = $task['resp_name'] ?? $task['responsible'] ?? 'Не указан';
			$minutes = $threshold_minutes === 1 ? 'минуту' : ($threshold_minutes % 10 === 1 && $threshold_minutes % 100 !== 11 ? 'минуту' : 'минут');
			$text = "<b>Задача в колонке уже {$threshold_minutes} {$minutes}!</b>\n<blockquote>Задача: <i>$title</i>\nКолонка: <i>$col</i>\nИсполнитель: <i>$resp</i></blockquote>";
			sendTelegram($bot_token, $chat_id, $text);
			$sent[] = $task['id']; // Больше не шлём для этой задачи
		}
	}

	sleep(30); // Проверка каждые 30 сек
}
?>