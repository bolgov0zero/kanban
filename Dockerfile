FROM php:8.1-apache-bullseye

# Устанавливаем пакеты
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libsqlite3-0 \
        supervisor \
        openssl \
        sqlite3 && \
    rm -rf /var/lib/apt/lists/*

# Создаем SSL сертификат
RUN mkdir -p /etc/apache2/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/apache2/ssl/server.key \
        -out /etc/apache2/ssl/server.crt \
        -subj "/C=RU/ST=Moscow/L=Moscow/O=Kanban/CN=localhost" && \
    chmod 600 /etc/apache2/ssl/server.key

# Копируем ВСЕ файлы
COPY ./panel_files /var/www/html/
# Копируем entrypoint.sh с правами на выполнение (Docker 20.10+)
COPY --chmod=755 entrypoint.sh /var/www/html/

# Настраиваем Apache
RUN a2enmod rewrite ssl && \
    echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Создаем SSL конфигурацию (используем heredoc для читаемости)
RUN cat > /etc/apache2/sites-available/kanban-ssl.conf << 'EOF'
<VirtualHost *:443>
    DocumentRoot /var/www/html
    SSLEngine on
    SSLCertificateFile /etc/apache2/ssl/server.crt
    SSLCertificateKeyFile /etc/apache2/ssl/server.key
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF

# Создаем HTTP конфигурацию с редиректом
RUN cat > /etc/apache2/sites-available/kanban-http.conf << 'EOF'
<VirtualHost *:80>
    ServerName localhost
    Redirect permanent / https://localhost/
</VirtualHost>
EOF

# Включаем наши сайты, отключаем стандартные
RUN a2dissite 000-default default-ssl && \
    a2ensite kanban-http kanban-ssl

# Настраиваем PHP
RUN cat > /usr/local/etc/php/conf.d/kanban.ini << 'EOF'
display_errors = Off
display_startup_errors = Off
error_reporting = E_ALL
log_errors = On
error_log = /var/log/php_errors.log
EOF

# Устанавливаем права
RUN chown -R www-data:www-data /var/www/html && \
    find /var/www/html -type f -exec chmod 644 {} \; && \
    find /var/www/html -type d -exec chmod 755 {} \; && \
    # Отладка: проверим права на entrypoint
    ls -l /var/www/html/entrypoint.sh

# Создаем необходимые директории
RUN mkdir -p /var/log /data && \
    chown www-data:www-data /var/log /data && \
    chmod 775 /var/log /data

# Открываем порты
EXPOSE 80 443

# Запуск
ENTRYPOINT ["/var/www/html/entrypoint.sh"]