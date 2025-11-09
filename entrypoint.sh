#!/bin/bash
set -e

# Инициализация БД, если файл не существует
if [ ! -f "/var/www/html/db.sqlite" ]; then
	echo "Инициализация БД..."
	cd /var/www/html
	php init_db.php
fi

# Запуск Apache
exec "$@"