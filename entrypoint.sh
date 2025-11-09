#!/bin/bash
# Создаём директорию для логов, если её нет
mkdir -p /var/log
chown www-data:www-data /var/log
chmod 775 /var/log

# Устанавливаем права на монтированную директорию /var/www/html
chown -R www-data:www-data /var/www/html
find /var/www/html -type f -exec chmod 644 {} \;
find /var/www/html -type d -exec chmod 755 {} \;

# Если .htaccess существует, устанавливаем права
[ -f /var/www/html/.htaccess ] && chmod 644 /var/www/html/.htaccess || true

# Устанавливаем права на директории /data и /etc/apache2/ssl
chown -R www-data:www-data /data /etc/apache2/ssl
chmod -R 775 /data
chmod 600 /etc/apache2/ssl/server.key
chmod 644 /etc/apache2/ssl/server.crt

# Устанавливаем supervisord для управления фоновыми процессами (если нужно; для Kanban опционально)
mkdir -p /etc/supervisor/conf.d

# Создаём конфигурацию для supervisord (пустая, если нет фоновых задач; можно добавить позже)
cat > /etc/supervisor/conf.d/kanban.conf <<EOF
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

# Если нужно добавить фоновый процесс, раскомментируйте и настройте
#[program:kanban-cron]
#command=php /var/www/html/some_cron.php
#autostart=true
#autorestart=true
#stderr_logfile=/var/log/kanban-cron.err.log
#stdout_logfile=/var/log/kanban-cron.out.log
EOF

# Запускаем init_db.php и логируем вывод
echo "Запуск init_db.php..." >> /var/log/init_db.log
php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1
if [ $? -ne 0 ]; then
	echo "Ошибка при выполнении init_db.php, смотрите /var/log/init_db.log" >&2
fi

# Запускаем supervisord (если есть конфиги; иначе можно убрать)
supervisord -c /etc/supervisor/supervisord.conf &

# Запускаем Apache в foreground-режиме
exec apache2-foreground