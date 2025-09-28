// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Конфигурация
const CONFIG = {
    // Твой токен бота
    BOT_TOKEN: '8414918030:AAG32jw18WxxZ-ALE1SN0rd0BI8m4nzlS5Q',
    
    // Аккаунты для входа
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" }
    ],
    
    // ID чатов для демо (в реальном приложении будут настоящие chat_id)
    demoChatIds: {
        '247': '247',
        '001': '001', 
        '749': '749'
    }
};

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let messageInterval = null;

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setBackgroundColor('#000000');
    tg.setHeaderColor('#000000');
    
    // Проверяем, есть ли сохраненный пользователь
    checkSavedUser();
    
    // Инициализируем интерфейс
    initInterface();
}

// Проверка сохраненного пользователя
function checkSavedUser() {
    const savedUser = localStorage.getItem('wolf_current_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showPage('app');
            loadUserInterface();
            startMessagePolling();
        } catch (e) {
            localStorage.removeItem('wolf_current_user');
        }
    }
}

// Инициализация интерфейса
function initInterface() {
    // Обработчик отправки сообщения
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Обработчик изменения размера окна
    window.addEventListener('resize', handleResize);
    handleResize();
}

// Обработчик изменения размера
function handleResize() {
    if (window.innerWidth > 768) {
        // ПК режим
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').style.display = 'flex';
        document.querySelector('.header-back').style.display = 'none';
    } else {
        // Мобильный режим
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').style.display = 'none';
        document.querySelector('.header-back').style.display = 'block';
    }
}

// Проверка пароля и вход
async function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const isValid = CONFIG.validAccounts.find(acc => acc.login === login && acc.password === password);

    if (isValid) {
        errorMessage.textContent = '';
        
        // Устанавливаем текущего пользователя
        currentUser = {
            login: login,
            name: isValid.name,
            chatId: isValid.chatId
        };
        
        // Сохраняем в localStorage
        localStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        showPage('app');
        loadUserInterface();
        startMessagePolling();
        
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
    }
}

// Загрузка интерфейса пользователя
function loadUserInterface() {
    // Обновляем информацию о текущем пользователе
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    // Загружаем контакты
    loadContacts();
    
    // Показываем приветственное сообщение
    showWelcomeMessage();
}

// Загрузка контактов
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    
    // Фильтруем текущего пользователя из списка контактов
    const contacts = CONFIG.validAccounts.filter(acc => acc.login !== currentUser.login);
    
    if (contacts.length === 0) {
        contactsList.innerHTML = '<div class="loading">Нет доступных контактов</div>';
        return;
    }
    
    contactsList.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact';
        contactElement.dataset.userId = contact.login;
        
        // Случайный онлайн статус для демо
        const isOnline = Math.random() > 0.3;
        const statusClass = isOnline ? 'status-online' : 'status-offline';
        const lastSeen = isOnline ? 'online' : 'был(а) недавно';
        
        contactElement.innerHTML = `
            <div class="contact-avatar ${statusClass}">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${lastSeen}</div>
            </div>
        `;
        
        contactElement.addEventListener('click', () => openChat(contact));
        contactsList.appendChild(contactElement);
    });
}

// Открытие чата с пользователем
function openChat(contact) {
    currentChat = contact;
    
    // Обновляем заголовок чата
    document.getElementById('partnerAvatar').textContent = contact.login;
    document.getElementById('partnerName').textContent = contact.name;
    document.getElementById('partnerStatus').textContent = 'online';
    
    // Активируем поле ввода
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    // Загружаем историю сообщений
    loadChatHistory(contact.login);
    
    // На мобильных переключаем на окно чата
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    // Помечаем контакт как активный
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`).classList.add('active');
}

// Загрузка истории чата
async function loadChatHistory(contactId) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    try {
        // Загружаем сообщения из Telegram Bot API
        const messages = await getBotMessages();
        const chatMessages = messages.filter(msg => 
            (msg.sender === currentUser.login && msg.receiver === contactId) ||
            (msg.sender === contactId && msg.receiver === currentUser.login)
        );
        
        displayMessages(chatMessages);
        
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
        // Показываем демо-сообщения
        showDemoMessages();
    }
}

// Получение сообщений из Telegram Bot API
async function getBotMessages() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/getUpdates`);
        const data = await response.json();
        
        if (data.ok) {
            return parseBotMessages(data.result);
        } else {
            throw new Error(data.description);
        }
    } catch (error) {
        console.error('Ошибка получения сообщений:', error);
        return [];
    }
}

// Парсинг сообщений из Bot API
function parseBotMessages(updates) {
    const messages = [];
    
    updates.forEach(update => {
        if (update.message && update.message.text) {
            const msg = update.message;
            
            // Определяем отправителя и получателя на основе текста
            // В реальном приложении нужно будет настроить логику определения чатов
            const parts = msg.text.split('|');
            if (parts.length >= 3) {
                messages.push({
                    sender: parts[0],
                    receiver: parts[1],
                    text: parts[2],
                    time: new Date(msg.date * 1000).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}),
                    type: 'text'
                });
            }
        }
    });
    
    return messages;
}

// Отображение сообщений
function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    messages.forEach(msg => {
        const messageType = msg.sender === currentUser.login ? 'sent' : 'received';
        addMessageToUI(msg.text, messageType, msg.time);
    });
}

// Показ демо-сообщений (если Bot API не доступен)
function showDemoMessages() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    const demoMessages = [
        { text: 'Привет! Как дела?', type: 'received', time: '10:30' },
        { text: 'Привет! Все отлично, работаем!', type: 'sent', time: '10:31' },
        { text: 'Есть новости по заданию?', type: 'received', time: '10:32' },
        { text: 'Да, все по плану. Отчет готовлю.', type: 'sent', time: '10:33' }
    ];
    
    demoMessages.forEach(msg => {
        addMessageToUI(msg.text, msg.type, msg.time);
    });
}

// Отправка сообщения через Telegram Bot API
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text || !currentChat) return;
    
    const message = {
        text: text,
        sender: currentUser.login,
        receiver: currentChat.login,
        time: getCurrentTime(),
        type: 'text'
    };
    
    try {
        // Отправляем сообщение через Bot API
        await sendMessageToBot(message);
        
        // Добавляем сообщение в интерфейс
        addMessageToUI(text, 'sent', message.time);
        messageInput.value = '';
        
        // Обновляем последнее сообщение в списке контактов
        updateLastMessage(currentChat.login, text);
        
        // Имитируем ответ
        simulateResponse();
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        // Все равно показываем сообщение в интерфейсе
        addMessageToUI(text, 'sent', message.time);
        messageInput.value = '';
        simulateResponse();
    }
}

// Отправка сообщения через Bot API
async function sendMessageToBot(message) {
    // Форматируем сообщение для парсинга
    const formattedText = `${message.sender}|${message.receiver}|${message.text}`;
    
    const response = await fetch(`https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CONFIG.demoChatIds[message.receiver],
            text: formattedText,
            parse_mode: 'HTML'
        })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
        throw new Error(data.description);
    }
    
    return data;
}

// Добавление сообщения в интерфейс
function addMessageToUI(text, type, time) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Убираем welcome сообщение если есть
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Имитация ответа
function simulateResponse() {
    if (!currentChat) return;
    
    setTimeout(() => {
        const responses = [
            'Понял!',
            'Принято!', 
            'Работаем!',
            'Ясно!',
            'Хорошо!',
            'Сделано!'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        
        addMessageToUI(response, 'received', getCurrentTime());
        updateLastMessage(currentChat.login, response);
    }, 1000 + Math.random() * 2000);
}

// Обновление последнего сообщения в списке контактов
function updateLastMessage(contactId, message) {
    const contactElement = document.querySelector(`[data-user-id="${contactId}"]`);
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message;
        }
    }
}

// Запуск опроса новых сообщений
function startMessagePolling() {
    // Проверяем новые сообщения каждые 5 секунд
    messageInterval = setInterval(async () => {
        if (currentChat) {
            await loadChatHistory(currentChat.login);
        }
    }, 5000);
}

// Вспомогательные функции
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

function showWelcomeMessage() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <img src="wolf-logo.png" alt="Wolf" class="welcome-logo">
            <div class="welcome-text">Wolf Messenger готов к работе</div>
            <div class="welcome-subtext">Выберите контакт для начала общения</div>
        </div>
    `;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function goBack() {
    if (window.innerWidth <= 768) {
        hideChatWindow();
    }
}

function showChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'none';
    document.querySelector('.chat-window').style.display = 'flex';
}

function hideChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'flex';
    document.querySelector('.chat-window').style.display = 'none';
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    tg.ready();
    initApp();
});

// Очистка при закрытии
window.addEventListener('beforeunload', function() {
    if (messageInterval) {
        clearInterval(messageInterval);
    }
});
