# === СТАДИЯ СБОРКИ (только для PHP-расширений) ===
FROM php:8.1-apache-bullseye AS builder

# Устанавливаем dev-зависимости и расширения
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libsqlite3-dev \
        ca-certificates && \
    docker-php-ext-install pdo_sqlite && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# === ФИНАЛЬНЫЙ ОБРАЗ (минимальный) ===
FROM php:8.1-apache-bullseye

# Устанавливаем runtime-пакеты + openssl (временно)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        supervisor \
        ca-certificates \
        openssl && \
    \
    # Создаём директории
    mkdir -p /opt/kanban /data /etc/apache2/ssl /var/log && \
    chown -R www-data:www-data /opt/kanban /data /etc/apache2/ssl /var/log && \
    chmod -R 775 /opt/kanban /data /var/log && \
    \
    # Генерируем SSL-сертификат
    openssl req -x509 -nodes -days 7300 -newkey rsa:2048 \
        -keyout /etc/apache2/ssl/server.key \
        -out /etc/apache2/ssl/server.crt \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=iDisk Project/CN=Kanban Panel" && \
    chmod 600 /etc/apache2/ssl/server.key && \
    chmod 644 /etc/apache2/ssl/server.crt && \
    \
    # Удаляем openssl и кэш
    apt-get remove -y openssl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/*

# Копируем приложение
COPY . /var/www/html/

# Настраиваем Apache и PHP (всё в одном RUN)
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf && \
    \
    # Включаем модули через симлинки
    ln -sf /etc/apache2/mods-available/rewrite.load /etc/apache2/mods-enabled/rewrite.load && \
    ln -sf /etc/apache2/mods-available/ssl.load /etc/apache2/mods-enabled/ssl.load && \
    ln -sf /etc/apache2/mods-available/socache_shmcb.load /etc/apache2/mods-enabled/socache_shmcb.load && \
    \
    # files.conf
    { \
        echo "Alias /files /opt/kanban"; \
        echo "<Directory /opt/kanban>"; \
        echo "    Options Indexes FollowSymLinks"; \
        echo "    AllowOverride All"; \
        echo "    Require all granted"; \
        echo "</Directory>"; \
    } > /etc/apache2/conf-available/files.conf && \
    ln -sf /etc/apache2/conf-available/files.conf /etc/apache2/conf-enabled/files.conf && \
    \
    # default-ssl.conf (HTTPS)
    { \
        echo "<VirtualHost *:443>"; \
        echo "    DocumentRoot /var/www/html"; \
        echo "    SSLEngine on"; \
        echo "    SSLCertificateFile /etc/apache2/ssl/server.crt"; \
        echo "    SSLCertificateKeyFile /etc/apache2/ssl/server.key"; \
        echo "    <Directory /var/www/html>"; \
        echo "        Options Indexes FollowSymLinks"; \
        echo "        AllowOverride None"; \
        echo "        Require all granted"; \
        echo "    </Directory>"; \
        echo "</VirtualHost>"; \
    } > /etc/apache2/sites-available/default-ssl.conf && \
    ln -sf /etc/apache2/sites-available/default-ssl.conf /etc/apache2/sites-enabled/default-ssl.conf && \
    \
    # 000-default.conf (редирект HTTP → HTTPS)
    { \
        echo "<VirtualHost *:80>"; \
        echo "    ServerName localhost"; \
        echo "    Redirect permanent / https://localhost/"; \
        echo "</VirtualHost>"; \
    } > /etc/apache2/sites-available/000-default.conf && \
    ln -sf /etc/apache2/sites-available/000-default.conf /etc/apache2/sites-enabled/000-default.conf && \
    \
    # Отключаем default конфиг если существует
    rm -f /etc/apache2/sites-enabled/000-default.conf && \
    \
    # PHP: отключение ошибок в продакшене
    { \
        echo "display_errors = Off"; \
        echo "display_startup_errors = Off"; \
        echo "error_reporting = E_ALL"; \
        echo "log_errors = On"; \
        echo "error_log = /var/log/php_errors.log"; \
    } > /usr/local/etc/php/conf.d/errors.ini && \
    \
    # Устанавливаем права
    chown -R www-data:www-data /var/www/html && \
    find /var/www/html -type f -exec chmod 644 {} \; && \
    find /var/www/html -type d -exec chmod 755 {} \; && \
    chmod +x /var/www/html/entrypoint.sh && \
    chmod +x /var/www/html/monitoring.php

# Открываем порты
EXPOSE 80 443

# Запуск
ENTRYPOINT ["/var/www/html/entrypoint.sh"]