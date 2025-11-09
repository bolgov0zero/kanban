<?php
date_default_timezone_set('Europe/Moscow');  // <-- Добавлено: UTC+3 (Москва)
session_start();
if (!isset($_SESSION['user'])) exit('auth required');
$db = new SQLite3('/data/db.sqlite');
$user = $_SESSION['user'];
$isAdmin = $_SESSION['is_admin'] ?? 0;
$action = $_POST['action'] ?? '';

// Функция отправки Telegram (обновлена на cURL для лучшей совместимости)
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
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Для теста; в проде true
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

// Получаем Telegram настройки
$tg_settings = $db->querySingle("SELECT bot_token, chat_id, timer_threshold FROM telegram_settings WHERE id=1", true);
$bot_token = $tg_settings['bot_token'] ?? '';
$chat_id = $tg_settings['chat_id'] ?? '';
$timer_threshold = $tg_settings['timer_threshold'] ?? 60;

// Получаем имя текущего пользователя
$user_name_stmt = $db->prepare("SELECT name FROM users WHERE username = :u");
$user_name_stmt->bindValue(':u', $user, SQLITE3_TEXT);
$user_name = $user_name_stmt->execute()->fetchArray(SQLITE3_ASSOC)['name'] ?? $user;

switch ($action) {
	case 'get_telegram_settings':
		if(!$isAdmin) exit('forbidden');
		$stmt = $db->prepare("SELECT bot_token, chat_id, timer_threshold FROM telegram_settings WHERE id=1");
		$res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
		echo json_encode($res ?: ['bot_token' => '', 'chat_id' => '', 'timer_threshold' => 60], JSON_UNESCAPED_UNICODE);
		break;

	case 'save_telegram_settings':
		if(!$isAdmin) exit('forbidden');
		$token = trim($_POST['bot_token'] ?? '');
		$chat = trim($_POST['chat_id'] ?? '');
		$threshold = max(1, (int)($_POST['timer_threshold'] ?? 60)); // min 1
		$stmt = $db->prepare("INSERT OR REPLACE INTO telegram_settings (id, bot_token, chat_id, timer_threshold) VALUES (1, :t, :c, :th)");
		$stmt->bindValue(':t', $token, SQLITE3_TEXT);
		$stmt->bindValue(':c', $chat, SQLITE3_TEXT);
		$stmt->bindValue(':th', $threshold, SQLITE3_INTEGER);
		$stmt->execute();
		echo json_encode(['success' => true, 'message' => 'Настройки сохранены']);
		break;

	case 'test_telegram':
		if(!$isAdmin) exit('forbidden');
		$text = "🔔 <b>Тестовое уведомление</b> от Kanban-доски\nДата: " . date('Y-m-d H:i:s');
		$result = sendTelegram($bot_token, $chat_id, $text);
		if ($result) {
			echo json_encode(['success' => true, 'message' => 'Отправлено!']);
		} else {
			echo json_encode(['success' => false, 'message' => 'Ошибка отправки. Проверьте логи сервера (/var/log/apache2/error.log или аналог). Убедитесь, что bot_token и chat_id верны.']);
		}
		break;

	case 'add_column':
		if(!$isAdmin) exit('forbidden');
		$stmt = $db->prepare("INSERT INTO columns (name, bg_color, task_color, auto_complete, timer) VALUES (:n, :b, :t, :a, :tm)");
		foreach([':n'=>'name', ':b'=>'bg_color', ':t'=>'task_color'] as $k => $v) $stmt->bindValue($k, $_POST[$v]);
		$stmt->bindValue(':a', (int)($_POST['auto_complete'] ?? 0));
		$stmt->bindValue(':tm', (int)($_POST['timer'] ?? 0));
		$stmt->execute();
		break;

	case 'update_column':
		if(!$isAdmin) exit('forbidden');
		$stmt = $db->prepare("UPDATE columns SET name=:n, bg_color=:b, task_color=:t, auto_complete=:a, timer=:tm WHERE id=:id");
		foreach([':n'=>'name', ':b'=>'bg_color', ':t'=>'task_color'] as $k => $v) $stmt->bindValue($k, $_POST[$v]);
		$stmt->bindValue(':a', (int)$_POST['auto_complete']);
		$stmt->bindValue(':tm', (int)($_POST['timer'] ?? 0));
		$stmt->bindValue(':id', (int)$_POST['id']);
		$stmt->execute();
		break;

	case 'delete_column':
		if(!$isAdmin) exit('forbidden');
		$id=(int)$_POST['id'];
		$db->exec("DELETE FROM tasks WHERE column_id=$id");
		$db->exec("DELETE FROM columns WHERE id=$id");
		break;

	case 'get_column':
		if(!$isAdmin) exit('forbidden');
		$id = (int)$_POST['id'];
		echo json_encode($db->query("SELECT * FROM columns WHERE id=$id")->fetchArray(SQLITE3_ASSOC), JSON_UNESCAPED_UNICODE);
		break;

	case 'get_columns':
		$res = $db->query("SELECT id, name FROM columns ORDER BY id");
		$list = []; while ($r = $res->fetchArray(SQLITE3_ASSOC)) $list[] = $r;
		echo json_encode($list, JSON_UNESCAPED_UNICODE);
		break;

	case 'add_task':
		$stmt=$db->prepare("INSERT INTO tasks (title,description,responsible,deadline,importance,column_id,created_at) VALUES (:t,:d,:r,:dl,:i,:c,:cr)");
		foreach([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance',':c'=>'column_id'] as $k=>$v)
			$stmt->bindValue($k,$_POST[$v]);
		$stmt->bindValue(':cr',date('Y-m-d H:i:s'));
		$stmt->execute();
		// Уведомление
		if (!empty($bot_token) && !empty($chat_id)) {
			$title = trim($_POST['title'] ?? 'Без названия');
			$resp = trim($_POST['responsible'] ?? 'Не указан');
			$resp_name = $db->querySingle("SELECT name FROM users WHERE username='$resp'", true)['name'] ?? $resp;
			$text = "⚠️ <b>Новая задача</b>\n<blockquote>👤 <b>Автор:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i>\n🧑‍💻 <b>Исполнитель:</b> <i>$resp_name</i></blockquote>";
			$result = sendTelegram($bot_token, $chat_id, $text);
			if (!$result) error_log("Failed to send new task notification");
		}
		break;

	case 'update_task':
		$stmt=$db->prepare("UPDATE tasks SET title=:t,description=:d,responsible=:r,deadline=:dl,importance=:i WHERE id=:id");
		foreach([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v)
			$stmt->bindValue($k,$_POST[$v]);
		$stmt->bindValue(':id',(int)$_POST['id']);
		$stmt->execute();break;

	case 'delete_task':
		if(!$isAdmin) exit('forbidden');
		$id=(int)$_POST['id'];
		// Получаем данные задачи перед удалением
		$task_data = $db->querySingle("SELECT title, responsible FROM tasks WHERE id=$id", true);
		$db->exec("DELETE FROM tasks WHERE id=$id");
		// Уведомление (если нужно)
		if (!empty($bot_token) && !empty($chat_id) && $task_data) {
			$title = $task_data['title'] ?? 'Без названия';
			$text = "🗑️ <b>Задача удалена</b>\n<blockquote>👤 <b>Кем:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i></blockquote>";
			$result = sendTelegram($bot_token, $chat_id, $text);
			if (!$result) error_log("Failed to send delete task notification");
		}
		break;

	case 'move_task':
		$task_id = (int)$_POST['task_id'];
		$col_id = (int)$_POST['column_id'];
		// Обновляем колонку
		$stmt = $db->prepare("UPDATE tasks SET column_id = :c WHERE id = :id");
		$stmt->bindValue(':c', $col_id, SQLITE3_INTEGER);
		$stmt->bindValue(':id', $task_id, SQLITE3_INTEGER);
		$stmt->execute();
		
		// Получаем данные колонки для уведомлений
		$col = $db->querySingle("SELECT * FROM columns WHERE id = $col_id", true);
		$title = $db->querySingle("SELECT title FROM tasks WHERE id = $task_id", true)['title'] ?? 'Без названия';
		$resp = $db->querySingle("SELECT responsible FROM tasks WHERE id = $task_id", true)['responsible'] ?? 'Не указан';
		$resp_name = $db->querySingle("SELECT name FROM users WHERE username='$resp'", true)['name'] ?? $resp;
		$col_name = $col['name'] ?? 'Неизвестная колонка';
		
		// Если колонка с таймером, обновляем moved_at в UTC и сбрасываем notified_at
		if ($col['timer']) {
			$stmt_move = $db->prepare("UPDATE tasks SET moved_at = :moved, notified_at = NULL WHERE id = :id");
			$stmt_move->bindValue(':moved', gmdate('Y-m-d H:i:s'), SQLITE3_TEXT);  // UTC time
			$stmt_move->bindValue(':id', $task_id, SQLITE3_INTEGER);
			$stmt_move->execute();
		}
		
		// Уведомление о перемещении (без изменений)
		if (!empty($bot_token) && !empty($chat_id)) {
			$move_text = "➡️ <b>Задача перемещена</b>\n<blockquote>👤 <b>Кем:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i>\n📂 <b>В колонку:</b> <i>$col_name</i>\n🧑‍💻 <b>Исполнитель:</b> <i>$resp_name</i></blockquote>";
			$result = sendTelegram($bot_token, $chat_id, $move_text);
			if (!$result) error_log("Failed to send move task notification");
		}
		
		// Уведомление о завершении, если колонка с auto_complete (без изменений)
		if ($col['auto_complete']) {
			$complete_text = "✅ <b>Задача завершена</b>\n<blockquote>👤 <b>Кем:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i></blockquote>";
			sendTelegram($bot_token, $chat_id, $complete_text);
			// Устанавливаем completed=1
			$db->exec("UPDATE tasks SET completed = 1 WHERE id = $task_id");
		}
		break;

	case 'archive_now':
		$id=(int)$_POST['id'];
		$row=$db->query("SELECT t.*, COALESCE(u.name, t.responsible) AS responsible_name FROM tasks t LEFT JOIN users u ON t.responsible = u.username WHERE t.id=$id")->fetchArray(SQLITE3_ASSOC);
		if($row){
			$stmt=$db->prepare("INSERT INTO archive (title,description,responsible,responsible_name,deadline,importance,archived_at)
				VALUES (:t,:d,:r,:rn,:dl,:i,:a)");
			foreach([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v)
				$stmt->bindValue($k,$row[$v]);
			$stmt->bindValue(':rn', $row['responsible_name']);
			$stmt->bindValue(':a',date('Y-m-d H:i:s'));
			$stmt->execute();
			$db->exec("DELETE FROM tasks WHERE id=$id");
			// Уведомление (обновлено на имя)
			if (!empty($bot_token) && !empty($chat_id)) {
				$title = $row['title'] ?? 'Без названия';
				$resp_name = $row['responsible_name'] ?? 'Не указан';
				$text = "📦 <b>Задача заархивирована</b>\n<blockquote>👤 <b>Кем:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i></blockquote>";
				$result = sendTelegram($bot_token, $chat_id, $text);
				if (!$result) error_log("Failed to send archive notification");
			}
		} 
		break;

	case 'get_archive':
		$res=$db->query("SELECT * FROM archive ORDER BY archived_at DESC");
		$list=[];while($r=$res->fetchArray(SQLITE3_ASSOC))$list[]=$r;
		echo json_encode($list,JSON_UNESCAPED_UNICODE);
		break;

	case 'restore_task':
		$id=(int)$_POST['id'];
		$row=$db->query("SELECT * FROM archive WHERE id=$id")->fetchArray(SQLITE3_ASSOC);
		if($row){
			$stmt=$db->prepare("INSERT INTO tasks (title,description,responsible,deadline,importance,column_id,created_at)
				VALUES (:t,:d,:r,:dl,:i,:c,:cr)");
			foreach([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v)
				$stmt->bindValue($k,$row[$v]);
			$stmt->bindValue(':c',1); // возвращаем в первую колонку
			$stmt->bindValue(':cr',date('Y-m-d H:i:s'));
			$stmt->execute();
			$db->exec("DELETE FROM archive WHERE id=$id");
			// Уведомление о восстановлении
			if (!empty($bot_token) && !empty($chat_id)) {
				$title = $row['title'] ?? 'Без названия';
				$resp = $row['responsible'] ?? 'Не указан';
				$resp_name = $db->querySingle("SELECT name FROM users WHERE username='$resp'", true)['name'] ?? $resp;
				$first_col = $db->querySingle("SELECT name FROM columns WHERE id=1", true)['name'] ?? 'Первая колонка';
				$text = "🔄 <b>Задача восстановлена из архива</b>\n<blockquote>👤 <b>Кем:</b> <i>$user_name</i>\n📋 <b>Задача:</b> <i>$title</i>\n📂 <b>В колонку:</b> <i>$first_col</i>\n🧑‍💻 <b>Исполнитель:</b> <i>$resp_name</i></blockquote>";
				$result = sendTelegram($bot_token, $chat_id, $text);
				if (!$result) error_log("Failed to send restore notification");
			}
		} break;

	case 'get_users':
		$res=$db->query("SELECT username, is_admin, name FROM users ORDER BY username");
		$list=[];while($r=$res->fetchArray(SQLITE3_ASSOC))$list[]=$r;
		echo json_encode($list,JSON_UNESCAPED_UNICODE);break;

	case 'get_user':
		if(!$isAdmin) exit('forbidden');
		$username = trim($_POST['username']);
		$stmt = $db->prepare("SELECT * FROM users WHERE username = :u");
		$stmt->bindValue(':u', $username, SQLITE3_TEXT);
		$res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
		echo json_encode($res, JSON_UNESCAPED_UNICODE);
		break;

	case 'add_user':
		if(!$isAdmin) exit('forbidden');
		$username=trim($_POST['username']);
		$pass=password_hash(trim($_POST['password']),PASSWORD_DEFAULT);
		$is_adm=(int)($_POST['is_admin']??0);
		$full_name=trim($_POST['name']??'');
		$stmt = $db->prepare("INSERT INTO users (username, password, is_admin, name) VALUES (:u, :p, :a, :n)");
		$stmt->bindValue(':u', $username, SQLITE3_TEXT);
		$stmt->bindValue(':p', $pass, SQLITE3_TEXT);
		$stmt->bindValue(':a', $is_adm, SQLITE3_INTEGER);
		$stmt->bindValue(':n', $full_name, SQLITE3_TEXT);
		$stmt->execute();
		break;

	case 'update_user':
		if(!$isAdmin) exit('forbidden');
		$username=trim($_POST['username']);
		$is_adm=(int)($_POST['is_admin']??0);
		$full_name=trim($_POST['name']??'');
		$password = trim($_POST['password'] ?? '');
		if ($password) {
			$hashed_pass = password_hash($password, PASSWORD_DEFAULT);
			$stmt = $db->prepare("UPDATE users SET is_admin=:a, name=:n, password=:p WHERE username=:u");
			$stmt->bindValue(':p', $hashed_pass, SQLITE3_TEXT);
		} else {
			$stmt = $db->prepare("UPDATE users SET is_admin=:a, name=:n WHERE username=:u");
		}
		$stmt->bindValue(':a', $is_adm, SQLITE3_INTEGER);
		$stmt->bindValue(':n', $full_name, SQLITE3_TEXT);
		$stmt->bindValue(':u', $username, SQLITE3_TEXT);
		$stmt->execute();
		break;

	case 'delete_user':
		if(!$isAdmin) exit('forbidden');
		$name=trim($_POST['username']);
		$db->exec("DELETE FROM users WHERE username='$name' AND username!='user1'");
		break;
		
	case 'clear_archive':
		if(!$isAdmin) exit('forbidden');
		$db->exec("DELETE FROM archive");
		echo json_encode(['success' => true]);
		break;
}
?>