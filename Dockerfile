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

# Устанавливаем runtime-пакеты
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
    # Удаляем ненужные пакеты и кэш
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/*

# Копируем entrypoint и monitoring ПЕРВЫМИ с правильными правами
COPY entrypoint.sh /usr/local/bin/

# Даем права на выполнение
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/monitoring.php

# Копируем основные файлы приложения из panel_files
COPY ./panel_files/ /var/www/html/

# Настраиваем Apache
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Включаем необходимые модули Apache
RUN a2enmod rewrite ssl

# Создаем конфигурацию для файлов
RUN echo "Alias /files /opt/kanban" > /etc/apache2/conf-available/kanban-files.conf && \
    echo "<Directory /opt/kanban>" >> /etc/apache2/conf-available/kanban-files.conf && \
    echo "    Options Indexes FollowSymLinks" >> /etc/apache2/conf-available/kanban-files.conf && \
    echo "    AllowOverride All" >> /etc/apache2/conf-available/kanban-files.conf && \
    echo "    Require all granted" >> /etc/apache2/conf-available/kanban-files.conf && \
    echo "</Directory>" >> /etc/apache2/conf-available/kanban-files.conf

RUN a2enconf kanban-files

# Создаем SSL виртуальный хост
RUN echo "<VirtualHost *:443>" > /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    DocumentRoot /var/www/html" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLEngine on" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLCertificateFile /etc/apache2/ssl/server.crt" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLCertificateKeyFile /etc/apache2/ssl/server.key" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    <Directory /var/www/html>" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "        Options Indexes FollowSymLinks" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "        AllowOverride None" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "        Require all granted" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    </Directory>" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "</VirtualHost>" >> /etc/apache2/sites-available/kanban-ssl.conf

# Создаем HTTP виртуальный хост с редиректом на HTTPS
RUN echo "<VirtualHost *:80>" > /etc/apache2/sites-available/kanban-http.conf && \
    echo "    ServerName localhost" >> /etc/apache2/sites-available/kanban-http.conf && \
    echo "    Redirect permanent / https://localhost/" >> /etc/apache2/sites-available/kanban-http.conf && \
    echo "</VirtualHost>" >> /etc/apache2/sites-available/kanban-http.conf

# Отключаем стандартные сайты и включаем наши
RUN a2dissite 000-default default-ssl && \
    a2ensite kanban-http kanban-ssl

# Настраиваем PHP
RUN echo "display_errors = Off" > /usr/local/etc/php/conf.d/kanban.ini && \
    echo "display_startup_errors = Off" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "error_reporting = E_ALL" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "log_errors = On" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "error_log = /var/log/php_errors.log" >> /usr/local/etc/php/conf.d/kanban.ini

# Устанавливаем права на файлы приложения
RUN chown -R www-data:www-data /var/www/html && \
    find /var/www/html -type f -exec chmod 644 {} \; && \
    find /var/www/html -type d -exec chmod 755 {} \;

# Открываем порты
EXPOSE 80 443

# Запуск
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]