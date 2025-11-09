<?php
session_start();
$db = new SQLite3(__DIR__ . '/data/db.sqlite');

$first_user = false;
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	// Проверяем, есть ли пользователи
	$user_count = $db->querySingle("SELECT COUNT(*) FROM users");
	
	if ($user_count == 0) {
		// Создание первого пользователя (админа)
		$username = trim($_POST['username']);
		$password = trim($_POST['password']);
		$name = trim($_POST['name'] ?? '');
		
		if (empty($username) || empty($password)) {
			$error = "Логин и пароль обязательны";
		} else {
			$hashed_pass = password_hash($password, PASSWORD_DEFAULT);
			$stmt = $db->prepare("INSERT INTO users (username, password, is_admin, name) VALUES (:u, :p, 1, :n)");
			$stmt->bindValue(':u', $username, SQLITE3_TEXT);
			$stmt->bindValue(':p', $hashed_pass, SQLITE3_TEXT);
			$stmt->bindValue(':n', $name, SQLITE3_TEXT);
			$result = $stmt->execute();
			
			if ($result) {
				$_SESSION['user'] = $username;
				$_SESSION['is_admin'] = 1;
				header('Location: index.php');
				exit;
			} else {
				$error = "Ошибка создания пользователя";
			}
		}
	} else {
		// Обычная авторизация
		$username = trim($_POST['username']);
		$password = trim($_POST['password']);

		$stmt = $db->prepare("SELECT * FROM users WHERE username = :username");
		$stmt->bindValue(':username', $username);
		$res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

		if ($res && password_verify($password, $res['password'])) {
			$_SESSION['user'] = $res['username'];
			$_SESSION['is_admin'] = $res['is_admin'];
			header('Location: index.php');
			exit;
		} else {
			$error = "Неверное имя пользователя или пароль";
		}
	}
} else {
	// При GET: проверяем, нужно ли создать первого пользователя
	$user_count = $db->querySingle("SELECT COUNT(*) FROM users");
	if ($user_count == 0) {
		$first_user = true;
	}
}
?>
<!DOCTYPE html>
<html lang="ru" class="dark">
<head>
	<meta charset="UTF-8">
	<title>Авторизация</title>
	<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-gray-100 flex items-center justify-center h-screen">
	<?php if ($first_user): ?>
		<form method="POST" class="bg-gray-800 p-8 rounded-xl shadow-md w-80">
			<h2 class="text-xl mb-4 text-center">Создать первого администратора</h2>
			<?php if (!empty($error)) echo "<p class='text-red-400 mb-3'>$error</p>"; ?>
			<input name="username" placeholder="Логин" class="w-full mb-3 p-2 rounded bg-gray-700 border border-gray-600" required>
			<input name="password" type="password" placeholder="Пароль" class="w-full mb-3 p-2 rounded bg-gray-700 border border-gray-600" required>
			<input name="name" placeholder="Имя (опционально)" class="w-full mb-3 p-2 rounded bg-gray-700 border border-gray-600">
			<button class="w-full bg-green-600 hover:bg-green-500 p-2 rounded">Создать</button>
			<p class="text-xs text-gray-400 mt-3 text-center">Этот аккаунт получит права администратора</p>
		</form>
	<?php else: ?>
		<form method="POST" class="bg-gray-800 p-8 rounded-xl shadow-md w-80">
			<h2 class="text-xl mb-4 text-center">Вход в Kanban</h2>
			<?php if (!empty($error)) echo "<p class='text-red-400 mb-3'>$error</p>"; ?>
			<input name="username" placeholder="Логин" class="w-full mb-3 p-2 rounded bg-gray-700 border border-gray-600">
			<input type="password" name="password" placeholder="Пароль" class="w-full mb-3 p-2 rounded bg-gray-700 border border-gray-600">
			<button class="w-full bg-blue-600 hover:bg-blue-500 p-2 rounded">Войти</button>
		</form>
	<?php endif; ?>
</body>
</html>