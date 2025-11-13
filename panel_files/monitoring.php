<?php
date_default_timezone_set('Europe/Moscow');

// Функция для отправки уведомлений в Telegram
function sendTelegramNotification($bot_token, $chat_id, $message) {
	if (empty($bot_token) || empty($chat_id)) {
		return false;
	}
	
	$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
	$data = [
		'chat_id' => $chat_id,
		'text' => $message,
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
	$result = @file_get_contents($url, false, $context);
	
	return $result !== false;
}

// Основной цикл мониторинга
function monitorTasks() {
	$db_path = '/var/www/html/data/db.sqlite';
	
	if (!file_exists($db_path)) {
		error_log("Database not found: $db_path");
		return;
	}
	
	try {
		$db = new SQLite3($db_path);
		
		// Получаем настройки Telegram
		$tg_settings = $db->querySingle("SELECT bot_token, chat_id FROM telegram_settings WHERE id=1", true);
		$bot_token = $tg_settings['bot_token'] ?? '';
		$chat_id = $tg_settings['chat_id'] ?? '';
		
		if (empty($bot_token) || empty($chat_id)) {
			error_log("Telegram settings not configured");
			return;
		}
		
		// Получаем задачи с включенным таймером
		$query = "
			SELECT t.id, t.title, t.moved_at, t.responsible, 
				   c.name as column_name, u.name as responsible_name
			FROM tasks t 
			LEFT JOIN columns c ON t.column_id = c.id 
			LEFT JOIN users u ON t.responsible = u.username 
			WHERE c.timer = 1 
			AND t.moved_at IS NOT NULL 
			AND t.completed = 0
		";
		
		$result = $db->query($query);
		$notified_tasks = [];
		
		// Читаем уже уведомленные задачи из файла
		$notified_file = '/var/www/html/notified_tasks.json';
		if (file_exists($notified_file)) {
			$notified_tasks = json_decode(file_get_contents($notified_file), true) ?: [];
		}
		
		$current_time = time();
		$updated = false;
		
		while ($task = $result->fetchArray(SQLITE3_ASSOC)) {
			$task_id = $task['id'];
			$moved_time = strtotime($task['moved_at']);
			$seconds_passed = ($current_time - $moved_time);
			
			// Если прошло больше 1 минуты (60 секунд) и еще не уведомляли
			if ($seconds_passed > 60 && !in_array($task_id, $notified_tasks)) {
				$responsible_name = $task['responsible_name'] ?: $task['responsible'];
				$column_name = $task['column_name'] ?: 'Неизвестная колонка';
				
				$message = "⚠️ <b>Задача превысила лимит времени</b>\n\n";
				$message .= "📋 <b>Задача:</b> " . htmlspecialchars($task['title']) . "\n";
				$message .= "📂 <b>Колонка:</b> " . htmlspecialchars($column_name) . "\n";
				$message .= "⏱️ <b>Время в колонке:</b> " . round($seconds_passed / 60, 1) . " минут\n";
				$message .= "👤 <b>Исполнитель:</b> " . htmlspecialchars($responsible_name) . "\n";
				$message .= "\n<i>Задача находится в этой колонке дольше установленного лимита</i>";
				
				// Отправляем уведомление
				if (sendTelegramNotification($bot_token, $chat_id, $message)) {
					$notified_tasks[] = $task_id;
					$updated = true;
					error_log("Sent notification for task {$task_id}");
				} else {
					error_log("Failed to send notification for task {$task_id}");
				}
			}
		}
		
		// Сохраняем обновленный список уведомленных задач
		if ($updated) {
			file_put_contents($notified_file, json_encode($notified_tasks));
		}
		
		// Очищаем старые записи
		$all_tasks = $db->query("SELECT id FROM tasks WHERE completed = 0")->fetchAll(SQLITE3_ASSOC);
		$current_task_ids = array_column($all_tasks, 'id');
		$notified_tasks = array_intersect($notified_tasks, $current_task_ids);
		file_put_contents($notified_file, json_encode(array_values($notified_tasks)));
		
		$db->close();
		
	} catch (Exception $e) {
		error_log("Monitoring error: " . $e->getMessage());
	}
}

// Бесконечный цикл с проверкой каждую минуту
while (true) {
	monitorTasks();
	sleep(60); // 1 минута
}
?>