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
# Копируем entrypoint.sh с правами на выполнение (Docker 20.10+; если ошибка, удали --chmod=755 и добавь RUN chmod +x ниже)
COPY --chmod=755 entrypoint.sh /var/www/html/

# Настраиваем Apache
RUN a2enmod rewrite ssl && \
    echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Создаем SSL конфигурацию (цепочка echo для избежания heredoc-ошибок)
RUN echo "<VirtualHost *:443>" > /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    DocumentRoot /var/www/html" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLEngine on" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLCertificateFile /etc/apache2/ssl/server.crt" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    SSLCertificateKeyFile /etc/apache2/ssl/server.key" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    <Directory /var/www/html>" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "        AllowOverride All" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "        Require all granted" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "    </Directory>" >> /etc/apache2/sites-available/kanban-ssl.conf && \
    echo "</VirtualHost>" >> /etc/apache2/sites-available/kanban-ssl.conf

# Создаем HTTP конфигурацию с редиректом
RUN echo "<VirtualHost *:80>" > /etc/apache2/sites-available/kanban-http.conf && \
    echo "    ServerName localhost" >> /etc/apache2/sites-available/kanban-http.conf && \
    echo "    Redirect permanent / https://localhost/" >> /etc/apache2/sites-available/kanban-http.conf && \
    echo "</VirtualHost>" >> /etc/apache2/sites-available/kanban-http.conf

# Включаем наши сайты, отключаем стандартные
RUN a2dissite 000-default default-ssl && \
    a2ensite kanban-http kanban-ssl

# Настраиваем PHP (цепочка echo)
RUN echo "display_errors = Off" > /usr/local/etc/php/conf.d/kanban.ini && \
    echo "display_startup_errors = Off" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "error_reporting = E_ALL" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "log_errors = On" >> /usr/local/etc/php/conf.d/kanban.ini && \
    echo "error_log = /var/log/php_errors.log" >> /usr/local/etc/php/conf.d/kanban.ini

# Устанавливаем права (если --chmod=755 не сработал, раскомментируй следующую строку)
# RUN chmod +x /var/www/html/entrypoint.sh
RUN chown -R www-data:www-data /var/www/html && \
    find /var/www/html -type f -exec chmod 644 {} \; && \
    find /var/www/html -type d -exec chmod 755 {} \;

# Создаем необходимые директории
RUN mkdir -p /var/log /data && \
    chown www-data:www-data /var/log /data && \
    chmod 775 /var/log /data

# Открываем порты
EXPOSE 80 443

# Запуск
ENTRYPOINT ["/var/www/html/entrypoint.sh"]