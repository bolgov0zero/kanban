FROM php:8.2-apache

# Установка зависимостей
RUN apt-get update && apt-get install -y \
	sqlite3 \
	libsqlite3-dev \
	&& docker-php-ext-install pdo_sqlite \
	&& a2enmod rewrite \
	&& apt-get clean && rm -rf /var/lib/apt/lists/*

# Копируем файлы
WORKDIR /var/www/html
COPY . .

# Права на запись для БД (будет в volume)
RUN chown -R www-data:www-data /var/www/html \
	&& chmod -R 755 /var/www/html

# Entrypoint: запуск init_db.php, затем Apache
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["apache2-foreground"]