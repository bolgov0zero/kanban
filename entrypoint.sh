#!/bin/bash
set -e  # Остановка на ошибках

# Создаём директории
mkdir -p /var/log /data/db /etc/apache2/ssl
chown -R www-data:www-data /var/log /data /etc/apache2/ssl
chmod -R 775 /var/log /data
chmod 700 /etc/apache2/ssl  # Более строгие права для SSL

# Устанавливаем права на /var/www/html
chown -R www-data:www-data /var/www/html
find /var/www/html -type f -exec chmod 644 {} \;
find /var/www/html -type d -exec chmod 755 {} \;

# .htaccess, если есть
[ -f /var/www/html/.htaccess ] && chmod 644 /var/www/html/.htaccess || true

# Права на SSL
chmod 600 /etc/apache2/ssl/server.key
chmod 644 /etc/apache2/ssl/server.crt

# Supervisord (минимальный, без фоновых задач)
mkdir -p /etc/supervisor/conf.d
cat > /etc/supervisor/conf.d/supervisord.conf <<EOF
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid
EOF

# Если БД не существует, запускаем init_db.php от www-data
DB_PATH="/data/db.sqlite"
if [ ! -f "$DB_PATH" ]; then
	echo "База не найдена, запускаем init_db.php..." | tee -a /var/log/init_db.log
	su-exec www-data:www-data php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1
	if [ $? -ne 0 ]; then
		echo "Ошибка init_db.php! Лог: /var/log/init_db.log" >&2
		exit 1
	fi
	echo "База инициализирована: $DB_PATH" | tee -a /var/log/init_db.log
	chown www-data:www-data "$DB_PATH"
	chmod 664 "$DB_PATH"
else
	echo "База уже существует: $DB_PATH" | tee -a /var/log/init_db.log
	chown www-data:www-data "$DB_PATH"
	chmod 664 "$DB_PATH"
fi

# Запуск supervisord (если нужно; иначе уберите)
supervisord -c /etc/supervisor/conf.d/supervisord.conf &

# Apache в foreground
exec apache2-foreground