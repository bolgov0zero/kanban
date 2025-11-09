#!/bin/bash
set -e

# Создаём директорию для логов
mkdir -p /var/log
chown www-data:www-data /var/log
chmod 775 /var/log

# Устанавливаем права на приложение
chown -R www-data:www-data /var/www/html
find /var/www/html -type f -exec chmod 644 {} \;
find /var/www/html -type d -exec chmod 755 {} \;

# Права на /data и ssl
chown -R www-data:www-data /data /etc/apache2/ssl
chmod -R 775 /data
chmod 700 /etc/apache2/ssl
chmod 600 /etc/apache2/ssl/server.key
chmod 644 /etc/apache2/ssl/server.crt

# Инициализация БД
echo "=== Инициализация БД ===" >> /var/log/init_db.log
php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1
if [ $? -ne 0 ]; then
    echo "=== ОШИБКА init_db.php ===" >> /var/log/init_db.log
    exit 1
fi

# Права на db.sqlite после init
if [ -f /data/db.sqlite ]; then
    chown www-data:www-data /data/db.sqlite
    chmod 664 /data/db.sqlite
fi

# Запуск Apache
exec apache2-foreground