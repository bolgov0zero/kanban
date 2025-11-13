#!/bin/bash

# Создаём директории для логов
mkdir -p /var/log
chown www-data:www-data /var/log
chmod 775 /var/log

# Устанавливаем права на SSL сертификаты
chown -R root:root /etc/apache2/ssl
chmod 600 /etc/apache2/ssl/server.key
chmod 644 /etc/apache2/ssl/server.crt

# Устанавливаем права на данные
mkdir -p /data
chown -R www-data:www-data /data
chmod 775 /data

# Создаем файл для уведомленных задач
touch /var/www/html/notified_tasks.json
chown www-data:www-data /var/www/html/notified_tasks.json
chmod 664 /var/www/html/notified_tasks.json

# Создаем конфигурацию supervisord
mkdir -p /etc/supervisor/conf.d

cat > /etc/supervisor/conf.d/kanban.conf << EOF
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
pidfile=/var/run/supervisord.pid

[program:task-monitor]
command=php /var/www/html/monitoring.php
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
echo "$(date): Инициализация БД..." >> /var/log/init_db.log
php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1

if [ $? -eq 0 ]; then
    echo "$(date): БД успешно инициализирована" >> /var/log/init_db.log
else
    echo "$(date): Ошибка инициализации БД" >> /var/log/init_db.log
fi

# Инициализируем файл уведомленных задач
if [ ! -s /var/www/html/notified_tasks.json ]; then
    echo "[]" > /var/www/html/notified_tasks.json
    chown www-data:www-data /var/www/html/notified_tasks.json
fi

# Запускаем supervisord
echo "$(date): Запуск supervisord..." >> /var/log/supervisord.log
exec supervisord -c /etc/supervisor/supervisord.conf