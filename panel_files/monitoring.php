<?php
date_default_timezone_set('UTC');  // Унифицируем в UTC
$db = new SQLite3('/data/db.sqlite');

// Функция отправки Telegram (без изменений)
function sendTelegram($bot_token, $chat_id, $text) {
	if (empty($bot_token) || empty($chat_id)) {
		error_log("Telegram: empty token or chat_id");
		return false;
	}
	$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
	$post_data = [
		'chat_id' => $chat_id,
		'text' => $text,
		'parse_mode' => 'HTML'
	];

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
	curl_setopt($ch, CURLOPT_TIMEOUT, 10);

	$result = curl_exec($ch);
	$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error = curl_error($ch);
	curl_close($ch);

	if ($error) {
		error_log("Telegram cURL error: " . $error);
		return false;
	}

	$response = json_decode($result, true);
	if ($http_code !== 200 || !($response['ok'] ?? false)) {
		error_log("Telegram API error: HTTP $http_code, Response: " . print_r($response, true));
		return false;
	}

	return true;
}

// Infinite loop
while (true) {
	echo date('Y-m-d H:i:s UTC') . " - Начинаем проверку таймеров...\n";
	try {
		// Получаем настройки
		$tg = $db->querySingle("SELECT bot_token, chat_id, timer_threshold FROM telegram_settings WHERE id=1", true);
		echo "Настройки: threshold=" . ($tg['timer_threshold'] ?? 'NULL') . ", token=" . (empty($tg['bot_token']) ? 'EMPTY' : 'OK') . ", chat=" . (empty($tg['chat_id']) ? 'EMPTY' : 'OK') . "\n";
		
		if (empty($tg['bot_token']) || empty($tg['chat_id']) || empty($tg['timer_threshold'])) {
			echo "Пропуск: настройки неполные. Sleep 60s.\n";
			sleep(60);
			continue;
		}

		$threshold_sec = $tg['timer_threshold'] * 60;

		// Запрос ВСЕХ задач с таймером (для дебага)
		$query_all = "SELECT t.id, t.title, t.moved_at, t.notified_at, c.name as col_name 
					  FROM tasks t JOIN columns c ON t.column_id = c.id 
					  WHERE c.timer = 1 AND t.moved_at IS NOT NULL";
		$all_tasks = $db->query($query_all);
		echo "Найдено задач с таймером: " . $all_tasks->numRows() . "\n";
		
		// Запрос только для уведомлений (с UTC в strftime для moved_at)
		$query_notify = "SELECT t.id, t.title, t.moved_at FROM tasks t 
						 JOIN columns c ON t.column_id = c.id 
						 WHERE c.timer = 1 
						 AND t.moved_at IS NOT NULL 
						 AND t.notified_at IS NULL 
						 AND (strftime('%s', 'now', 'utc') - strftime('%s', t.moved_at, 'utc')) > :threshold";
		$stmt = $db->prepare($query_notify);
		$stmt->bindValue(':threshold', $threshold_sec, SQLITE3_INTEGER);
		$notify_tasks = $stmt->execute();
		echo "Задач для уведомления (elapsed > threshold): " . $notify_tasks->numRows() . "\n";
		
		$notify_count = 0;
		// Логируем ВСЕ задачи (даже не для notify)
		$all_result = $db->query($query_all);
		while ($row = $all_result->fetchArray(SQLITE3_ASSOC)) {
			$moved_time = strtotime($row['moved_at'] . ' UTC');
			$elapsed_sec = time() - $moved_time;
			$reason = ($row['notified_at'] !== null) ? "notified уже отправлено" : ($elapsed_sec <= $threshold_sec ? "elapsed ($elapsed_sec s) <= threshold ($threshold_sec s)" : "OK для отправки");
			echo "Задача {$row['id']} '{$row['title']}' в {$row['col_name']}: moved_at={$row['moved_at']}, elapsed=" . round($elapsed_sec / 60, 1) . " мин, $reason\n";
		}
		
		// Отправляем для подходящих
		while ($row = $notify_tasks->fetchArray(SQLITE3_ASSOC)) {
			$moved_time = strtotime($row['moved_at'] . ' UTC');
			$elapsed_sec = time() - $moved_time;
			$elapsed = gmdate('H:i:s', $elapsed_sec);
			$text = "⏰ <b>Таймер превышен!</b>\n<blockquote>📋 <b>Задача:</b> <i>" . htmlspecialchars($row['title']) . "</i>\n🕐 <b>Время в колонке:</b> <i>$elapsed</i></blockquote>";

			echo "  Отправляем для задачи {$row['id']}: elapsed=$elapsed_sec s\n";
			if (sendTelegram($tg['bot_token'], $tg['chat_id'], $text)) {
				$update = $db->prepare("UPDATE tasks SET notified_at = datetime('now', 'utc') WHERE id = :id");
				$update->bindValue(':id', $row['id'], SQLITE3_INTEGER);
				$update->execute();
				echo "    -> Успех! notified_at = " . date('Y-m-d H:i:s UTC') . "\n";
				$notify_count++;
			} else {
				echo "    -> Ошибка отправки (см. error.log)\n";
			}
		}
		echo "Итого уведомлений отправлено: $notify_count\n";
	} catch (Exception $e) {
		echo date('Y-m-d H:i:s UTC') . " - Ошибка: " . $e->getMessage() . "\n";
		error_log(date('Y-m-d H:i:s UTC') . " - Monitoring error: " . $e->getMessage() . "\n");
	}

	echo "Sleep 60s...\n";
	sleep(60);
}
?>