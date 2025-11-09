# === СТАДИЯ СБОРКИ ===
FROM php:8.1-apache-bullseye AS builder

RUN apt-get update && \
	apt-get install -y --no-install-recommends \
		libsqlite3-dev \
		ca-certificates && \
	docker-php-ext-install pdo_sqlite && \
	rm -rf /var/lib/apt/lists/* /var/cache/apt/*

COPY ./panel_files /var/www/html
COPY version.json /var/www/html
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# === ФИНАЛЬНЫЙ ОБРАЗ ===
FROM php:8.1-apache-bullseye

COPY --from=builder /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=builder /usr/local/etc/php/ /usr/local/etc/php/
COPY --from=builder /var/www/html/ /var/www/html/
COPY --from=builder /usr/local/bin/entrypoint.sh /usr/local/bin/entrypoint.sh

# Runtime пакеты + su-exec
RUN apt-get update && \
	apt-get install -y --no-install-recommends \
		libsqlite3-0 \
		supervisor \
		ca-certificates \
		openssl \
		su-exec && \
	mkdir -p /data/db /var/log /etc/apache2/ssl && \
	chown -R www-data:www-data /data /var/log /etc/apache2/ssl && \
	chmod -R 775 /data /var/log && \
	chmod 700 /etc/apache2/ssl && \
	openssl req -x509 -nodes -days 7300 -newkey rsa:2048 \
		-keyout /etc/apache2/ssl/server.key \
		-out /etc/apache2/ssl/server.crt \
		-subj "/C=RU/ST=Moscow/L=Moscow/O=Kanban Project/CN=Kanban Panel" && \
	chmod 600 /etc/apache2/ssl/server.key && \
	chmod 644 /etc/apache2/ssl/server.crt && \
	apt-get remove -y openssl && \
	apt-get autoremove -y && \
	rm -rf /var/lib/apt/lists/* /var/cache/apt/* /tmp/*

# Настройка Apache/PHP
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf && \
	a2enmod rewrite ssl && \
	{ \
		echo "<VirtualHost *:443>"; \
		echo "    DocumentRoot /var/www/html"; \
		echo "    SSLEngine on"; \
		echo "    SSLCertificateFile /etc/apache2/ssl/server.crt"; \
		echo "    SSLCertificateKeyFile /etc/apache2/ssl/server.key"; \
		echo "    <Directory /var/www/html>"; \
		echo "        Options Indexes FollowSymLinks"; \
		echo "        AllowOverride All"; \
		echo "        Require all granted"; \
		echo "    </Directory>"; \
		echo "</VirtualHost>"; \
	} > /etc/apache2/sites-available/default-ssl.conf && \
	a2ensite default-ssl && \
	{ \
		echo "<VirtualHost *:80>"; \
		echo "    ServerName localhost"; \
		echo "    Redirect permanent / https://localhost/"; \
		echo "</VirtualHost>"; \
	} > /etc/apache2/sites-available/000-default.conf && \
	{ \
		echo "upload_max_filesize = 50M"; \
		echo "post_max_size = 50M"; \
	} > /usr/local/etc/php/conf.d/uploads.ini && \
	{ \
		echo "display_errors = Off"; \
		echo "display_startup_errors = Off"; \
	} > /usr/local/etc/php/conf.d/errors.ini

EXPOSE 80 443
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]