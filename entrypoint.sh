#!/bin/bash
set -e

# Обеспечиваем существование data и правильные права (для volume)
mkdir -p /var/www/html/data
chown -R www-data:www-data /var/www/html/data

# Инициализация БД, если файл не существует (или таблицы не созданы)
DB_PATH="/var/www/html/data/db.sqlite"
if [ ! -f "$DB_PATH" ] || [ ! -s "$DB_PATH" ]; then  # <-- Улучшено: проверка на пустой файл
	echo "Инициализация БД..."
	cd /var/www/html
	gosu www-data php init_db.php  # <-- Запуск от www-data для правильных прав
else
	echo "БД уже существует, пропускаем инициализацию."
fi

# Запуск Apache
exec "$@"