// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Аккаунты для входа
const correctAccounts = [
    { login: "247", password: "Utka2022@" },
    { login: "001", password: "Pomidor:2022@" },
    { login: "749", password: "Dinozavr456@" }
];

// Инициализация приложения
function initApp() {
    // Расширяем на весь экран
    tg.expand();
    
    // Включаем подтверждение закрытия
    tg.enableClosingConfirmation();
    
    // Устанавливаем цвет фона
    tg.setBackgroundColor('#000000');
    
    console.log('Telegram Mini App инициализирован');
}

// Проверка пароля
function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const isValid = correctAccounts.find(acc => acc.login === login && acc.password === password);

    if (isValid) {
        errorMessage.textContent = '';
        // Переключаем на основной интерфейс
        showPage('app');
        initChatInterface();
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
    }
}

// Переключение страниц
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Инициализация интерфейса чата
function initChatInterface() {
    // Обработчики для контактов
    const contacts = document.querySelectorAll('.contact');
    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            // Убираем активный класс у всех контактов
            contacts.forEach(c => c.classList.remove('active'));
            // Добавляем активный класс текущему контакту
            this.classList.add('active');
            
            // Обновляем заголовок чата
            const contactName = this.querySelector('.contact-name').textContent;
            updateChatHeader(contactName, this.dataset.chat);
            
            // На мобильных устройствах переключаем на окно чата
            if (window.innerWidth <= 768) {
                showChatWindow();
            }
        });
    });
    
    // Обработчик отправки сообщения
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-button');
    
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            addMessage(text, 'sent');
            messageInput.value = '';
            
            // Имитация ответа
            setTimeout(() => {
                addMessage('Сообщение получено', 'received');
            }, 1000);
        }
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Добавление нового сообщения
function addMessage(text, type) {
    const messagesContainer = document.querySelector('.messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                 now.getMinutes().toString().padStart(2, '0');
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обновление заголовка чата
function updateChatHeader(name, chatId) {
    const partnerName = document.querySelector('.partner-name');
    const partnerAvatar = document.querySelector('.partner-avatar');
    
    partnerName.textContent = name;
    partnerAvatar.textContent = chatId;
}

// Показать окно чата (для мобильных)
function showChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'none';
    document.querySelector('.chat-window').classList.add('active');
}

// Скрыть окно чата (для мобильных)
function hideChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'flex';
    document.querySelector('.chat-window').classList.remove('active');
}

// Обработчик изменения размера окна
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').classList.add('active');
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Ждем инициализации Telegram Web App
    tg.ready();
    initApp();
});

// Обработка видимости страницы
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        tg.expand();
    }
});
