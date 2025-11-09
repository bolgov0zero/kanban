#!/bin/bash
set -e

# Инициализация БД, если файл не существует
if [ ! -f "/var/www/html/data/db.sqlite" ]; then  # <-- Изменено: добавлен /data/
	echo "Инициализация БД..."
	cd /var/www/html
	php init_db.php
else
	echo "БД уже существует, пропускаем инициализацию."
fi

# Запуск Apache
exec "$@"