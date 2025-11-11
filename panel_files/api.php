<?php
date_default_timezone_set('Europe/Moscow');  // UTC+3 (Москва)
session_start();
if (!isset($_SESSION['user'])) exit('auth required');

$db = new SQLite3('/data/db.sqlite');
$user = $_SESSION['user'];
$isAdmin = $_SESSION['is_admin'] ?? 0;
$action = $_POST['action'] ?? '';

// ---------------------------------------------------------------------
//  Telegram – отправка сообщений (cURL)
// ---------------------------------------------------------------------
function sendTelegram($bot_token, $chat_id, $text) {
	if (empty($bot_token) || empty($chat_id)) {
		error_log("Telegram: empty token or chat_id");
		return false;
	}
	$url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
	$post_data = [
		'chat_id'    => $chat_id,
		'text'       => $text,
		'parse_mode' => 'HTML'
	];

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_POST, true);
	curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);   // в продакшн – true
	curl_setopt($ch, CURLOPT_TIMEOUT, 10);

	$result    = curl_exec($ch);
	$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$error     = curl_error($ch);
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

// ---------------------------------------------------------------------
//  Текущие Telegram-настройки (только token + chat_id)
// ---------------------------------------------------------------------
$tg_settings = $db->querySingle("SELECT bot_token, chat_id FROM telegram_settings WHERE id=1", true);
$bot_token   = $tg_settings['bot_token'] ?? '';
$chat_id     = $tg_settings['chat_id']   ?? '';

// ---------------------------------------------------------------------
//  Имя текущего пользователя (для уведомлений)
// ---------------------------------------------------------------------
$user_name_stmt = $db->prepare("SELECT name FROM users WHERE username = :u");
$user_name_stmt->bindValue(':u', $user, SQLITE3_TEXT);
$user_name = $user_name_stmt->execute()->fetchArray(SQLITE3_ASSOC)['name'] ?? $user;

// ---------------------------------------------------------------------
//  Обработчики действий
// ---------------------------------------------------------------------
switch ($action) {

	// -------------------------------------------------------------
	//  Telegram – настройки
	// -------------------------------------------------------------
	case 'get_telegram_settings':
		if (!$isAdmin) exit('forbidden');
		$res = $db->querySingle("SELECT bot_token, chat_id FROM telegram_settings WHERE id=1", true);
		echo json_encode($res ?: ['bot_token' => '', 'chat_id' => ''], JSON_UNESCAPED_UNICODE);
		break;

	case 'save_telegram_settings':
		if (!$isAdmin) exit('forbidden');
		$token = trim($_POST['bot_token'] ?? '');
		$chat  = trim($_POST['chat_id'] ?? '');
		$stmt  = $db->prepare("INSERT OR REPLACE INTO telegram_settings (id, bot_token, chat_id) VALUES (1, :t, :c)");
		$stmt->bindValue(':t', $token, SQLITE3_TEXT);
		$stmt->bindValue(':c', $chat,  SQLITE3_TEXT);
		$stmt->execute();
		echo json_encode(['success' => true, 'message' => 'Настройки сохранены']);
		break;

	case 'test_telegram':
		if (!$isAdmin) exit('forbidden');
		$text = "Тестовое уведомление от Kanban-доски\nДата: " . date('Y-m-d H:i:s');
		$result = sendTelegram($bot_token, $chat_id, $text);
		echo json_encode(
			$result
				? ['success' => true,  'message' => 'Отправлено!']
				: ['success' => false, 'message' => 'Ошибка отправки. Проверьте логи.']
		);
		break;

	// -------------------------------------------------------------
	//  Колонки
	// -------------------------------------------------------------
	case 'add_column':
		if (!$isAdmin) exit('forbidden');
		$stmt = $db->prepare("INSERT INTO columns (name, bg_color, task_color, auto_complete, timer) VALUES (:n, :b, :t, :a, :tm)");
		foreach ([':n'=>'name', ':b'=>'bg_color', ':t'=>'task_color'] as $k => $v) {
			$stmt->bindValue($k, $_POST[$v] ?? '');
		}
		$stmt->bindValue(':a',  (int)($_POST['auto_complete'] ?? 0));
		$stmt->bindValue(':tm', (int)($_POST['timer'] ?? 0));
		$stmt->execute();
		break;

	case 'update_column':
		if (!$isAdmin) exit('forbidden');
		$stmt = $db->prepare("UPDATE columns SET name=:n, bg_color=:b, task_color=:t, auto_complete=:a, timer=:tm WHERE id=:id");
		foreach ([':n'=>'name', ':b'=>'bg_color', ':t'=>'task_color'] as $k => $v) {
			$stmt->bindValue($k, $_POST[$v] ?? '');
		}
		$stmt->bindValue(':a',  (int)$_POST['auto_complete']);
		$stmt->bindValue(':tm', (int)($_POST['timer'] ?? 0));
		$stmt->bindValue(':id', (int)$_POST['id']);
		$stmt->execute();
		break;

	case 'delete_column':
		if (!$isAdmin) exit('forbidden');
		$id = (int)$_POST['id'];
		$db->exec("DELETE FROM tasks WHERE column_id=$id");
		$db->exec("DELETE FROM columns WHERE id=$id");
		break;

	case 'get_column':
		if (!$isAdmin) exit('forbidden');
		$id = (int)$_POST['id'];
		$row = $db->querySingle("SELECT * FROM columns WHERE id=$id", true);
		echo json_encode($row ?: [], JSON_UNESCAPED_UNICODE);
		break;

	// -------------------------------------------------------------
	//  Задачи
	// -------------------------------------------------------------
	case 'move_task':
		$task_id   = (int)$_POST['task_id'];
		$column_id = (int)$_POST['column_id'];

		// проверка, что колонка с таймером
		$col = $db->querySingle("SELECT timer FROM columns WHERE id=$column_id", true);
		$timer = $col['timer'] ?? 0;

		$now = date('Y-m-d H:i:s');
		$stmt = $db->prepare("UPDATE tasks SET column_id=:c, moved_at=:m WHERE id=:id");
		$stmt->bindValue(':c', $column_id, SQLITE3_INTEGER);
		$stmt->bindValue(':m', $timer ? $now : null, SQLITE3_TEXT);
		$stmt->bindValue(':id', $task_id, SQLITE3_INTEGER);
		$stmt->execute();
		break;

	case 'complete_task':
		$id = (int)$_POST['id'];
		$stmt = $db->prepare("UPDATE tasks SET completed=1 WHERE id=:id");
		$stmt->bindValue(':id', $id, SQLITE3_INTEGER);
		$stmt->execute();

		// Архивируем через 1 час (см. index.php) – здесь только помечаем completed
		break;

	case 'archive_now':
		$id = (int)$_POST['id'];
		$row = $db->querySingle("SELECT * FROM tasks WHERE id=$id", true);
		if ($row) {
			$stmt = $db->prepare("INSERT INTO archive (title,description,responsible,responsible_name,deadline,importance,archived_at)
				VALUES (:t,:d,:r,:rn,:dl,:i,:a)");
			foreach ([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v) {
				$stmt->bindValue($k, $row[$v] ?? '');
			}
			$stmt->bindValue(':rn', $row['responsible_name'] ?? '');
			$stmt->bindValue(':a', date('Y-m-d H:i:s'));
			$stmt->execute();
			$db->exec("DELETE FROM tasks WHERE id=$id");

			// Уведомление
			if (!empty($bot_token) && !empty($chat_id)) {
				$title = $row['title'] ?? 'Без названия';
				$text  = "Задача заархивирована\n<blockquote>Кем: <i>$user_name</i>\nЗадача: <i>$title</i></blockquote>";
				sendTelegram($bot_token, $chat_id, $text);
			}
		}
		break;

	case 'restore_task':
		$id = (int)$_POST['id'];
		$row = $db->querySingle("SELECT * FROM archive WHERE id=$id", true);
		if ($row) {
			$stmt = $db->prepare("INSERT INTO tasks (title,description,responsible,deadline,importance,column_id,created_at)
				VALUES (:t,:d,:r,:dl,:i,:c,:cr)");
			foreach ([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v) {
				$stmt->bindValue($k, $row[$v] ?? '');
			}
			$stmt->bindValue(':c', 1); // первая колонка
			$stmt->bindValue(':cr', date('Y-m-d H:i:s'));
			$stmt->execute();
			$db->exec("DELETE FROM archive WHERE id=$id");

			if (!empty($bot_token) && !empty($chat_id)) {
				$title = $row['title'] ?? 'Без названия';
				$first_col = $db->querySingle("SELECT name FROM columns WHERE id=1", true)['name'] ?? 'Первая колонка';
				$text = "Задача восстановлена из архива\n<blockquote>Кем: <i>$user_name</i>\nЗадача: <i>$title</i>\nКолонка: <i>$first_col</i></blockquote>";
				sendTelegram($bot_token, $chat_id, $text);
			}
		}
		break;

	case 'clear_archive':
		if (!$isAdmin) exit('forbidden');
		$db->exec("DELETE FROM archive");
		echo json_encode(['success' => true]);
		break;

	case 'get_archive':
		$res = $db->query("SELECT * FROM archive ORDER BY archived_at DESC");
		$list = [];
		while ($r = $res->fetchArray(SQLITE3_ASSOC)) $list[] = $r;
		echo json_encode($list, JSON_UNESCAPED_UNICODE);
		break;

	// -------------------------------------------------------------
	//  Пользователи
	// -------------------------------------------------------------
	case 'get_users':
		$res = $db->query("SELECT username, is_admin, name FROM users ORDER BY username");
		$list = [];
		while ($r = $res->fetchArray(SQLITE3_ASSOC)) $list[] = $r;
		echo json_encode($list, JSON_UNESCAPED_UNICODE);
		break;

	case 'get_user':
		if (!$isAdmin) exit('forbidden');
		$username = trim($_POST['username']);
		$stmt = $db->prepare("SELECT * FROM users WHERE username = :u");
		$stmt->bindValue(':u', $username, SQLITE3_TEXT);
		$res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
		echo json_encode($res ?: [], JSON_UNESCAPED_UNICODE);
		break;

	case 'add_user':
		if (!$isAdmin) exit('forbidden');
		$username  = trim($_POST['username']);
		$pass      = password_hash(trim($_POST['password']), PASSWORD_DEFAULT);
		$is_adm    = (int)($_POST['is_admin'] ?? 0);
		$full_name = trim($_POST['name'] ?? '');
		$stmt = $db->prepare("INSERT INTO users (username, password, is_admin, name) VALUES (:u, :p, :a, :n)");
		$stmt->bindValue(':u', $username, SQLITE3_TEXT);
		$stmt->bindValue(':p', $pass,    SQLITE3_TEXT);
		$stmt->bindValue(':a', $is_adm,  SQLITE3_INTEGER);
		$stmt->bindValue(':n', $full_name, SQLITE3_TEXT);
		$stmt->execute();
		break;

	case 'update_user':
		if (!$isAdmin) exit('forbidden');
		$username  = trim($_POST['username']);
		$is_adm    = (int)($_POST['is_admin'] ?? 0);
		$full_name = trim($_POST['name'] ?? '');
		$password  = trim($_POST['password'] ?? '');

		if ($password) {
			$hashed = password_hash($password, PASSWORD_DEFAULT);
			$stmt = $db->prepare("UPDATE users SET is_admin=:a, name=:n, password=:p WHERE username=:u");
			$stmt->bindValue(':p', $hashed, SQLITE3_TEXT);
		} else {
			$stmt = $db->prepare("UPDATE users SET is_admin=:a, name=:n WHERE username=:u");
		}
		$stmt->bindValue(':a', $is_adm,    SQLITE3_INTEGER);
		$stmt->bindValue(':n', $full_name, SQLITE3_TEXT);
		$stmt->bindValue(':u', $username,  SQLITE3_TEXT);
		$stmt->execute();
		break;

	case 'delete_user':
		if (!$isAdmin) exit('forbidden');
		$name = trim($_POST['username']);
		$db->exec("DELETE FROM users WHERE username='$name' AND username!='user1'");
		break;

	// -------------------------------------------------------------
	//  Задачи – CRUD (не меняем, только добавляем/обновляем)
	// -------------------------------------------------------------
	case 'add_task':
		$stmt = $db->prepare("INSERT INTO tasks (title,description,responsible,deadline,importance,column_id,created_at)
			VALUES (:t,:d,:r,:dl,:i,:c,:cr)");
		foreach ([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v) {
			$stmt->bindValue($k, $_POST[$v] ?? '');
		}
		$stmt->bindValue(':c',  (int)$_POST['column_id']);
		$stmt->bindValue(':cr', date('Y-m-d H:i:s'));
		$stmt->execute();
		break;

	case 'update_task':
		$id = (int)$_POST['id'];
		$stmt = $db->prepare("UPDATE tasks SET title=:t, description=:d, responsible=:r, deadline=:dl, importance=:i WHERE id=:id");
		foreach ([':t'=>'title',':d'=>'description',':r'=>'responsible',':dl'=>'deadline',':i'=>'importance'] as $k=>$v) {
			$stmt->bindValue($k, $_POST[$v] ?? '');
		}
		$stmt->bindValue(':id', $id, SQLITE3_INTEGER);
		$stmt->execute();
		break;

	case 'delete_task':
		$id = (int)$_POST['id'];
		$db->exec("DELETE FROM tasks WHERE id=$id");
		break;

	// -------------------------------------------------------------
	//  По умолчанию – ничего
	// -------------------------------------------------------------
	default:
		echo json_encode(['error' => 'unknown action']);
		break;
}
?>