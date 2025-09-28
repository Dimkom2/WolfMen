<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wolf Messenger</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
    <!-- Страница входа -->
    <div id="login-page" class="page active">
        <div class="login-container">
            <img src="wolf-logo.png" alt="Wolf Logo" class="login-logo">
            <div class="input-group">
                <input type="text" id="login" placeholder="ЛОГИН" class="login-input">
            </div>
            <div class="input-group">
                <input type="password" id="password" placeholder="ПАРОЛЬ" class="login-input">
            </div>
            <button onclick="checkPassword()" class="login-button">ВОЙТИ В СТАЮ</button>
            <div id="error-message" class="error-message"></div>
        </div>
    </div>

    <!-- Основной интерфейс мессенджера -->
    <div id="app" class="page">
        <!-- Панель контактов -->
        <div class="contacts-panel">
            <div class="panel-header">
                <div class="logo">
                    <img src="wolf-logo.png" alt="Wolf" class="wolf-logo-small">
                    <span>WOLF PACK</span>
                </div>
            </div>
            
            <div class="contacts-list">
                <div class="contact active" data-chat="247">
                    <div class="contact-avatar">247</div>
                    <div class="contact-info">
                        <div class="contact-name">Агент 247</div>
                        <div class="last-message">Готов к работе</div>
                    </div>
                    <div class="unread-badge">1</div>
                </div>
                
                <div class="contact" data-chat="org">
                    <div class="contact-avatar">ORG</div>
                    <div class="contact-info">
                        <div class="contact-name">Организатор</div>
                        <div class="last-message">Жду отчет</div>
                    </div>
                    <div class="unread-badge">3</div>
                </div>
            </div>
            
            <div class="user-profile">
                <div class="profile-avatar">ID</div>
                <div class="profile-name">Идентифицирован</div>
            </div>
        </div>

        <!-- Основное окно чата -->
        <div class="chat-window">
            <div class="chat-header">
                <div class="chat-partner">
                    <div class="partner-avatar">247</div>
                    <div class="partner-info">
                        <div class="partner-name">Агент 247</div>
                        <div class="partner-status">online</div>
                    </div>
                </div>
            </div>
            
            <div class="messages-container">
                <div class="message received">
                    <div class="message-content">
                        <div class="message-text">Статус операции?</div>
                        <div class="message-time">12:30</div>
                    </div>
                </div>
                
                <div class="message sent">
                    <div class="message-content">
                        <div class="message-text">Все по плану. Цель в зоне видимости.</div>
                        <div class="message-time">12:31</div>
                    </div>
                </div>
                
                <div class="message received">
                    <div class="message-content">
                        <div class="message-text">Жду сигнала для следующего шага.</div>
                        <div class="message-time">12:32</div>
                    </div>
                </div>
            </div>
            
            <div class="input-container">
                <div class="message-input-wrapper">
                    <input type="text" class="message-input" placeholder="Сообщение...">
                    <button class="send-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
