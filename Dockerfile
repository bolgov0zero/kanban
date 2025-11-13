# === ФИНАЛЬНЫЙ ОБРАЗ ===
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

# Создаем entrypoint.sh напрямую в контейнере
RUN echo '#!/bin/bash\n\
\n\
# Создаём директорию для логов\n\
mkdir -p /var/log\n\
chown www-data:www-data /var/log\n\
chmod 775 /var/log\n\
\n\
# Устанавливаем базовые права\n\
chown -R www-data:www-data /var/www/html /opt/kanban /data /etc/apache2/ssl\n\
find /var/www/html -type f -exec chmod 644 {} \\;\n\
find /var/www/html -type d -exec chmod 755 {} \\;\n\
chmod -R 775 /opt/kanban /data\n\
chmod 600 /etc/apache2/ssl/server.key\n\
chmod 644 /etc/apache2/ssl/server.crt\n\
\n\
# Создаем файл для отслеживания уведомленных задач\n\
touch /var/www/html/notified_tasks.json\n\
chown www-data:www-data /var/www/html/notified_tasks.json\n\
chmod 664 /var/www/html/notified_tasks.json\n\
\n\
# Создаём конфигурацию для supervisord\n\
mkdir -p /etc/supervisor/conf.d\n\
\n\
cat > /etc/supervisor/conf.d/kanban.conf << \"EOF\"\n\
[supervisord]\n\
nodaemon=true\n\
logfile=/var/log/supervisord.log\n\
pidfile=/var/run/supervisord.pid\n\
\n\
[program:task-monitor]\n\
command=php /var/www/html/monitoring.php\n\
autostart=true\n\
autorestart=true\n\
stderr_logfile=/var/log/task-monitor.err.log\n\
stdout_logfile=/var/log/task-monitor.out.log\n\
user=www-data\n\
\n\
[program:apache2]\n\
command=apache2-foreground\n\
autostart=true\n\
autorestart=true\n\
stderr_logfile=/var/log/apache2.err.log\n\
stdout_logfile=/var/log/apache2.out.log\n\
EOF\n\
\n\
# Инициализируем БД\n\
echo \"$(date): Запуск init_db.php...\" >> /var/log/init_db.log\n\
php /var/www/html/init_db.php >> /var/log/init_db.log 2>&1\n\
\n\
# Инициализируем файл уведомленных задач\n\
if [ ! -s /var/www/html/notified_tasks.json ]; then\n\
    echo \"[]\" > /var/www/html/notified_tasks.json\n\
    chown www-data:www-data /var/www/html/notified_tasks.json\n\
fi\n\
\n\
# Запускаем supervisord\n\
echo \"$(date): Запуск supervisord...\" >> /var/log/supervisord.log\n\
exec supervisord -c /etc/supervisor/supervisord.conf' > /usr/local/bin/entrypoint.sh

# Создаем monitoring.php напрямую в контейнере
RUN echo '<?php\n\
date_default_timezone_set('\''Europe/Moscow'\'');\n\
\n\
// Функция для отправки уведомлений в Telegram\n\
function sendTelegramNotification($bot_token, $chat_id, $message) {\n\
    if (empty($bot_token) || empty($chat_id)) {\n\
        return false;\n\
    }\n\
    \n\
    $url = \"https://api.telegram.org/bot{$bot_token}/sendMessage\";\n\
    $data = [\n\
        '\''chat_id'\'' => $chat_id,\n\
        '\''text'\'' => $message,\n\
        '\''parse_mode'\'' => '\''HTML'\''\n\
    ];\n\
    \n\
    $options = [\n\
        '\''http'\'' => [\n\
            '\''header'\'' => \"Content-type: application/x-www-form-urlencoded\\r\\n\",\n\
            '\''method'\'' => '\''POST'\'',\n\
            '\''content'\'' => http_build_query($data)\n\
        ]\n\
    ];\n\
    \n\
    $context = stream_context_create($options);\n\
    $result = @file_get_contents($url, false, $context);\n\
    \n\
    return $result !== false;\n\
}\n\
\n\
// Основной цикл мониторинга\n\
function monitorTasks() {\n\
    $db_path = '\''/var/www/html/db.sqlite'\'';\n\
    \n\
    if (!file_exists($db_path)) {\n\
        error_log(\"Database not found: $db_path\");\n\
        return;\n\
    }\n\
    \n\
    try {\n\
        $db = new SQLite3($db_path);\n\
        \n\
        // Получаем настройки Telegram\n\
        $tg_settings = $db->querySingle(\"SELECT bot_token, chat_id FROM telegram_settings WHERE id=1\", true);\n\
        $bot_token = $tg_settings['\''bot_token'\''] ?? '\'''\';\n\
        $chat_id = $tg_settings['\''chat_id'\''] ?? '\'''\';\n\
        \n\
        if (empty($bot_token) || empty($chat_id)) {\n\
            error_log(\"Telegram settings not configured\");\n\
            return;\n\
        }\n\
        \n\
        // Получаем задачи с включенным таймером\n\
        $query = \"\n\
            SELECT t.id, t.title, t.moved_at, t.responsible, \n\
                   c.name as column_name, u.name as responsible_name\n\
            FROM tasks t \n\
            LEFT JOIN columns c ON t.column_id = c.id \n\
            LEFT JOIN users u ON t.responsible = u.username \n\
            WHERE c.timer = 1 \n\
            AND t.moved_at IS NOT NULL \n\
            AND t.completed = 0\n\
        \";\n\
        \n\
        $result = $db->query($query);\n\
        $notified_tasks = [];\n\
        \n\
        // Читаем уже уведомленные задачи из файла\n\
        $notified_file = '\''/var/www/html/notified_tasks.json'\'';\n\
        if (file_exists($notified_file)) {\n\
            $notified_tasks = json_decode(file_get_contents($notified_file), true) ?: [];\n\
        }\n\
        \n\
        $current_time = time();\n\
        $updated = false;\n\
        \n\
        while ($task = $result->fetchArray(SQLITE3_ASSOC)) {\n\
            $task_id = $task['\''id'\''];\n\
            $moved_time = strtotime($task['\''moved_at'\'']);\n\
            $seconds_passed = ($current_time - $moved_time);\n\
            \n\
            // Если прошло больше 1 минуты (60 секунд) и еще не уведомляли\n\
            if ($seconds_passed > 60 && !in_array($task_id, $notified_tasks)) {\n\
                $responsible_name = $task['\''responsible_name'\''] ?: $task['\''responsible'\''];\n\
                $column_name = $task['\''column_name'\''] ?: '\''Неизвестная колонка'\'';\n\
                \n\
                $message = \"⚠️ <b>Задача превысила лимит времени</b>\\n\\n\";\n\
                $message .= \"📋 <b>Задача:</b> \" . htmlspecialchars($task['\''title'\'']) . \"\\n\";\n\
                $message .= \"📂 <b>Колонка:</b> \" . htmlspecialchars($column_name) . \"\\n\";\n\
                $message .= \"⏱️ <b>Время в колонке:</b> \" . round($seconds_passed / 60, 1) . \" минут\\n\";\n\
                $message .= \"👤 <b>Исполнитель:</b> \" . htmlspecialchars($responsible_name) . \"\\n\";\n\
                $message .= \"\\n<i>Задача находится в этой колонке дольше установленного лимита</i>\";\n\
                \n\
                // Отправляем уведомление\n\
                if (sendTelegramNotification($bot_token, $chat_id, $message)) {\n\
                    $notified_tasks[] = $task_id;\n\
                    $updated = true;\n\
                    error_log(\"Sent notification for task {$task_id}\");\n\
                } else {\n\
                    error_log(\"Failed to send notification for task {$task_id}\");\n\
                }\n\
            }\n\
        }\n\
        \n\
        // Сохраняем обновленный список уведомленных задач\n\
        if ($updated) {\n\
            file_put_contents($notified_file, json_encode($notified_tasks));\n\
        }\n\
        \n\
        // Очищаем старые записи\n\
        $all_tasks = $db->query(\"SELECT id FROM tasks WHERE completed = 0\")->fetchAll(SQLITE3_ASSOC);\n\
        $current_task_ids = array_column($all_tasks, '\''id'\'');\n\
        $notified_tasks = array_intersect($notified_tasks, $current_task_ids);\n\
        file_put_contents($notified_file, json_encode(array_values($notified_tasks)));\n\
        \n\
        $db->close();\n\
        \n\
    } catch (Exception $e) {\n\
        error_log(\"Monitoring error: \" . $e->getMessage());\n\
    }\n\
}\n\
\n\
// Бесконечный цикл с проверкой каждую минуту\n\
while (true) {\n\
    monitorTasks();\n\
    sleep(60); // 1 минута\n\
}\n\
?>' > /var/www/html/monitoring.php

# Даем права на выполнение
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    chmod 644 /var/www/html/monitoring.php

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