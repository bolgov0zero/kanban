<?php
date_default_timezone_set('Europe/Moscow');
$db = new SQLite3('/data/db.sqlite');

// Функция отправки Telegram (скопирована из api.php)
function sendTelegram($bot_token, $chat_id, $text) {
	if (empty($bot_token) || empty($chat_id)) return false;
	$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
	$data = [
		'chat_id' => $chat_id,
		'text' => $text,
		'parse_mode' => 'HTML'
	];
	$options = [
		'http' => [
			'header' => "Content-type: application/x-www-form-urlencoded\r\n",
			'method' => 'POST',
			'content' => http_build_query($data)
		]
	];
	$context = stream_context_create($options);
	$result = file_get_contents($url, false, $context);
	return json_decode($result, true)['ok'] ?? false;
}

// Infinite loop для мониторинга
while (true) {
	try {
		// Получаем настройки
		$tg = $db->querySingle("SELECT bot_token, chat_id, timer_threshold FROM telegram_settings WHERE id=1", true);
		if (empty($tg['bot_token']) || empty($tg['chat_id']) || empty($tg['timer_threshold'])) {
			sleep(60);
			continue;
		}

		$threshold_sec = $tg['timer_threshold'] * 60; // минуты -> секунды

		// Запрос: задачи с таймером, notified_at NULL, elapsed > threshold (используем UTC strftime)
		$query = "SELECT t.id, t.title, t.moved_at FROM tasks t 
				  JOIN columns c ON t.column_id = c.id 
				  WHERE c.timer = 1 
				  AND t.moved_at IS NOT NULL 
				  AND t.notified_at IS NULL 
				  AND (strftime('%s', 'now', 'utc') - strftime('%s', t.moved_at)) > :threshold";
		$stmt = $db->prepare($query);
		$stmt->bindValue(':threshold', $threshold_sec, SQLITE3_INTEGER);
		$result = $stmt->execute();

		while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
			$moved_time = strtotime($row['moved_at'] . ' UTC');  // Парсим как UTC
			$elapsed_sec = time() - $moved_time;  // Текущее time() - UTC moved
			$elapsed = gmdate('H:i:s', $elapsed_sec); // UTC формат

			$text = "⏰ <b>Таймер превышен!</b>\n<blockquote>📋 <b>Задача:</b> <i>" . htmlspecialchars($row['title']) . "</i>\n🕐 <b>Время в колонке:</b> <i>$elapsed</i></blockquote>";

			if (sendTelegram($tg['bot_token'], $tg['chat_id'], $text)) {
				// Отметить как уведомлённую
				$update = $db->prepare("UPDATE tasks SET notified_at = datetime('now', 'utc') WHERE id = :id");  // UTC для notified_at
				$update->bindValue(':id', $row['id'], SQLITE3_INTEGER);
				$update->execute();
				echo date('Y-m-d H:i:s') . " - Уведомление отправлено для задачи ID {$row['id']} (elapsed: $elapsed)\n";
			} else {
				echo date('Y-m-d H:i:s') . " - Ошибка отправки для задачи ID {$row['id']}\n";
			}
		}
	} catch (Exception $e) {
		error_log(date('Y-m-d H:i:s') . " - Monitoring error: " . $e->getMessage() . "\n");
	}

	sleep(60); // Проверка каждую минуту
}
?>