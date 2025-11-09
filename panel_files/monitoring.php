<?php
date_default_timezone_set('UTC');  // Унифицируем в UTC для consistency с moved_at
$db = new SQLite3('/data/db.sqlite');

// Функция отправки Telegram (без изменений, с cURL)
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

// Infinite loop для мониторинга
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

		// Запрос задач (с отладкой)
		$query = "SELECT t.id, t.title, t.moved_at, t.notified_at, c.name as col_name 
				  FROM tasks t JOIN columns c ON t.column_id = c.id 
				  WHERE c.timer = 1 AND t.moved_at IS NOT NULL";
		$all_tasks = $db->query($query);
		echo "Найдено задач с таймером: " . $all_tasks->numRows() . "\n";
		
		$notify_count = 0;
		while ($row = $all_tasks->fetchArray(SQLITE3_ASSOC)) {
			$moved_time = strtotime($row['moved_at'] . ' UTC');
			$elapsed_sec = time() - $moved_time;
			echo "Задача {$row['id']} '{$row['title']}' в {$row['col_name']}: moved_at={$row['moved_at']}, elapsed={$elapsed_sec}s (threshold={$threshold_sec}s), notified={$row['notified_at']}\n";
			
			if ($row['notified_at'] === null && $elapsed_sec > $threshold_sec) {
				$elapsed = gmdate('H:i:s', $elapsed_sec);
				$text = "⏰ <b>Таймер превышен!</b>\n<blockquote>📋 <b>Задача:</b> <i>" . htmlspecialchars($row['title']) . "</i>\n🕐 <b>Время в колонке:</b> <i>$elapsed</i></blockquote>";

				if (sendTelegram($tg['bot_token'], $tg['chat_id'], $text)) {
					$update = $db->prepare("UPDATE tasks SET notified_at = datetime('now', 'utc') WHERE id = :id");
					$update->bindValue(':id', $row['id'], SQLITE3_INTEGER);
					$update->execute();
					echo "  -> Уведомление отправлено! notified_at обновлено.\n";
					$notify_count++;
				} else {
					echo "  -> Ошибка отправки (проверьте error.log).\n";
				}
			} else {
				echo "  -> Пропуск: notified или elapsed <= threshold.\n";
			}
		}
		echo "Итого уведомлений отправлено: $notify_count\n";
	} catch (Exception $e) {
		echo date('Y-m-d H:i:s UTC') . " - Ошибка: " . $e->getMessage() . "\n";
		error_log(date('Y-m-d H:i:s UTC') . " - Monitoring error: " . $e->getMessage() . "\n");
	}

	echo "Sleep 60s до следующей проверки...\n";
	sleep(60);
}
?>