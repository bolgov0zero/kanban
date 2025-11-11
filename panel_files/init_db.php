<?php
date_default_timezone_set('Europe/Moscow');
$db = new SQLite3('/data/db.sqlite');

function ensureColumn($table, $column, $definition) {
	global $db;
	$exists = false;
	$res = $db->query("PRAGMA table_info($table)");
	while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
		if ($row['name'] === $column) {
			$exists = true;
			break;
		}
	}
	if (!$exists) {
		$db->exec("ALTER TABLE $table ADD COLUMN $column $definition");
	}
}

// === Создание таблиц ===
$db->exec("CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT UNIQUE,
	password TEXT,
	is_admin INTEGER DEFAULT 0,
	name TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS telegram_settings (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	bot_token TEXT,
	chat_id TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS columns (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	bg_color TEXT DEFAULT '#374151',
	task_color TEXT DEFAULT '#1f2937',
	auto_complete INTEGER DEFAULT 0
)");

$db->exec("CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT,
	description TEXT,
	responsible TEXT,
	deadline TEXT,
	importance TEXT,
	column_id INTEGER,
	completed INTEGER DEFAULT 0,
	created_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS archive (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT,
	description TEXT,
	responsible TEXT,
	responsible_name TEXT,
	deadline TEXT,
	importance TEXT,
	archived_at TEXT
)");

// === Дополнительные поля ===
ensureColumn('users', 'name', 'TEXT');
ensureColumn('columns', 'auto_complete', 'INTEGER DEFAULT 0');
ensureColumn('tasks', 'completed', 'INTEGER DEFAULT 0');
ensureColumn('tasks', 'created_at', 'TEXT');
ensureColumn('archive', 'responsible_name', 'TEXT');
ensureColumn('columns', 'timer', 'INTEGER DEFAULT 0');
ensureColumn('tasks', 'moved_at', 'TEXT');
ensureColumn('telegram_settings', 'timer_threshold', 'INTEGER DEFAULT 60');

// === Начальные Telegram настройки ===
$tg_exists = $db->querySingle("SELECT COUNT(*) FROM telegram_settings WHERE id=1");
if ($tg_exists == 0) {
	$stmt = $db->prepare("INSERT INTO telegram_settings (id, bot_token, chat_id) VALUES (1, '', '')");
	$stmt->execute();
}

// === Миграция responsible_name для archive (исправлено для SQLite: loop вместо UPDATE FROM) ===
$archive_count = $db->querySingle("SELECT COUNT(*) FROM archive");
if ($archive_count > 0) {
	$res = $db->query("SELECT id, responsible FROM archive");
	while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
		$resp_name = $db->querySingle("SELECT COALESCE(name, '{$row['responsible']}') FROM users WHERE username = '{$row['responsible']}'", true)['name'] ?? $row['responsible'];
		$stmt = $db->prepare("UPDATE archive SET responsible_name = :rn WHERE id = :id");
		$stmt->bindValue(':rn', $resp_name, SQLITE3_TEXT);
		$stmt->bindValue(':id', $row['id'], SQLITE3_INTEGER);
		$stmt->execute();
	}
}

echo "База данных успешно инициализирована! (пользователи и колонки создайте вручную)\n";
echo "<p><a href='auth.php'>Перейти к авторизации</a></p>";
?>
