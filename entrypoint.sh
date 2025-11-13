#!/bin/bash

# Создаём директорию для логов
mkdir -p /var/log
chown www-data:www-data /var/log
chmod 775 /var/log

# Устанавливаем базовые права
chown -R www-data:www-data /var/www/html /opt/kanban /data /etc/apache2/ssl
find /var/www/html -type f -exec chmod 644 {} \;
find /var/www/html -type d -exec chmod 755 {} \;
chmod -R 775 /opt/kanban /data
chmod 600 /etc/apache2/ssl/server.key
chmod 644 /etc/apache2/ssl/server.crt

# Создаем файл для отслеживания уведомленных задач
touch /var/www/html/notified_tasks.json
chown www-data:www-data /var/www/html/notified_tasks.json
chmod 664 /var/www/html/notified_tasks.json

# Создаём конфигурацию для supervisord
mkdir -p /etc/supervisor/conf.d

cat > /etc/supervisor/conf.d/kanban.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:task-monitor]
command=php /usr/local/bin/monitoring.php
autostart=true
autorestart=true
stderr_logfile=/var/log/task-monitor.err.log
stdout_logfile=/var/log/task-monitor.out.log
user=www-data

[program:apache2]
command=apache2-foreground
autostart=true
autorestart=true
stderr_logfile=/var/log/apache2.err.log
stdout_logfile=/var/log/apache2.out.log
EOF

# Инициализируем БД
echo "$(date): Запуск init_db.php..." >> /var/log/init_db.log
php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1

# Инициализируем файл уведомленных задач
if [ ! -s /var/www/html/notified_tasks.json ]; then
    echo "[]" > /var/www/html/notified_tasks.json
    chown www-data:www-data /var/www/html/notified_tasks.json
fi

# Запускаем supervisord
echo "$(date): Запуск supervisord..." >> /var/log/supervisord.log
exec supervisord -c /etc/supervisor/supervisord.conf