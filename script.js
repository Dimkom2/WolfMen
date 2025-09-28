// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Конфигурация
const CONFIG = {
    BOT_TOKEN: '8414918030:AAG32jw18WxxZ-ALE1SN0rd0BI8m4nzlS5Q',
    
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" }
    ]
};

let currentUser = null;
let currentChat = null;

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    // ВАЖНО: Сразу расширяем на весь экран
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setBackgroundColor('#000000');
    
    // Принудительно устанавливаем размеры для ПК
    setTimeout(() => {
        document.body.style.width = '100vw';
        document.body.style.height = '100vh';
        document.getElementById('app').style.display = 'flex';
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').style.display = 'flex';
    }, 100);
    
    checkSavedUser();
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
        } catch (e) {
            localStorage.removeItem('wolf_current_user');
        }
    }
}

// Инициализация интерфейса
function initInterface() {
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Сразу устанавливаем ПК режим если широкая страница
    if (window.innerWidth > 768) {
        forceDesktopMode();
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

// ПРИНУДИТЕЛЬНЫЙ РЕЖИМ ПК
function forceDesktopMode() {
    const app = document.getElementById('app');
    const contactsPanel = document.querySelector('.contacts-panel');
    const chatWindow = document.querySelector('.chat-window');
    const headerBack = document.querySelector('.header-back');
    
    app.style.display = 'flex';
    contactsPanel.style.display = 'flex';
    contactsPanel.style.width = '35%';
    chatWindow.style.display = 'flex'; 
    chatWindow.style.width = '65%';
    if (headerBack) headerBack.style.display = 'none';
    
    // Принудительно устанавливаем размеры
    document.body.style.minWidth = '800px';
    app.style.minWidth = '800px';
}

function handleResize() {
    if (window.innerWidth > 768) {
        forceDesktopMode();
    } else {
        // Мобильный режим
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '100%';
        document.querySelector('.chat-window').style.display = 'none';
        document.querySelector('.header-back').style.display = 'block';
    }
}

// Проверка пароля
async function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const isValid = CONFIG.validAccounts.find(acc => acc.login === login && acc.password === password);

    if (isValid) {
        errorMessage.textContent = '';
        
        currentUser = {
            login: login,
            name: isValid.name,
            chatId: isValid.chatId
        };
        
        localStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        showPage('app');
        loadUserInterface();
        
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
    }
}

// Загрузка интерфейса пользователя
function loadUserInterface() {
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    loadContacts();
    showWelcomeMessage();
}

// Загрузка контактов
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
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
        
        // Загружаем историю чата для последнего сообщения
        const chatHistory = loadChatHistoryFromStorage(currentUser.login, contact.login);
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].text : 'Нет сообщений';
        
        const isOnline = Math.random() > 0.3;
        const statusClass = isOnline ? 'status-online' : 'status-offline';
        const lastSeen = isOnline ? 'online' : 'был(а) недавно';
        
        contactElement.innerHTML = `
            <div class="contact-avatar ${statusClass}">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${lastMessage}</div>
            </div>
        `;
        
        contactElement.addEventListener('click', () => openChat(contact));
        contactsList.appendChild(contactElement);
    });
}

// Открытие чата
function openChat(contact) {
    currentChat = contact;
    
    document.getElementById('partnerAvatar').textContent = contact.login;
    document.getElementById('partnerName').textContent = contact.name;
    document.getElementById('partnerStatus').textContent = 'online';
    
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    loadChatHistory(contact.login);
    
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`).classList.add('active');
}

// Загрузка истории чата
function loadChatHistory(contactId) {
    const messagesContainer = document.getElementById('messagesContainer');
    const chatHistory = loadChatHistoryFromStorage(currentUser.login, contactId);
    
    displayMessages(chatHistory);
}

// Загрузка истории из localStorage
function loadChatHistoryFromStorage(user1, user2) {
    const chatKey = `wolf_chat_${user1}_${user2}`;
    const history = localStorage.getItem(chatKey);
    return history ? JSON.parse(history) : [];
}

// Сохранение истории в localStorage
function saveChatHistoryToStorage(user1, user2, messages) {
    const chatKey = `wolf_chat_${user1}_${user2}`;
    localStorage.setItem(chatKey, JSON.stringify(messages));
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
        addMessageToUI(msg.text, msg.type, msg.time, false); // false - не скроллить для каждого сообщения
    });
    
    // Скроллим один раз в конец
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Отправка сообщения
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text || !currentChat) return;

    const message = {
        text: text,
        sender: currentUser.login,
        receiver: currentChat.login,
        time: getCurrentTime(),
        type: 'sent'
    };
    
    try {
        // Сохраняем в историю ОТПРАВЛЕННОГО сообщения
        saveMessageToHistory(currentUser.login, currentChat.login, message);
        
        // Добавляем в интерфейс
        addMessageToUI(text, 'sent', message.time, true);
        messageInput.value = '';
        
        // Обновляем последнее сообщение в списке контактов
        updateLastMessage(currentChat.login, text);
        
        // Имитируем ответ через 1-2 секунды
        setTimeout(() => {
            simulateResponse();
        }, 1000 + Math.random() * 1000);
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        addMessageToUI(text, 'sent', message.time, true);
        messageInput.value = '';
    }
}

// Сохранение сообщения в историю
function saveMessageToHistory(user1, user2, message) {
    const history = loadChatHistoryFromStorage(user1, user2);
    history.push(message);
    saveChatHistoryToStorage(user1, user2, history);
}

// Имитация ответа
function simulateResponse() {
    if (!currentChat) return;
    
    const responses = [
        'Понял!',
        'Принято!', 
        'Работаем!',
        'Ясно!',
        'Хорошо!',
        'Сделано!',
        'Вас понял!',
        'Подтверждаю!'
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const responseMessage = {
        text: response,
        sender: currentChat.login,
        receiver: currentUser.login,
        time: getCurrentTime(),
        type: 'received'
    };
    
    // Сохраняем в историю ПОЛУЧЕННОГО сообщения
    saveMessageToHistory(currentUser.login, currentChat.login, responseMessage);
    
    // Добавляем в интерфейс
    addMessageToUI(response, 'received', responseMessage.time, true);
    
    // Обновляем последнее сообщение
    updateLastMessage(currentChat.login, response);
}

// Добавление сообщения в интерфейс
function addMessageToUI(text, type, time, shouldScroll = true) {
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
    
    if (shouldScroll) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Обновление последнего сообщения
function updateLastMessage(contactId, message) {
    const contactElement = document.querySelector(`[data-user-id="${contactId}"]`);
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message;
        }
    }
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
            <div class="welcome-text">Начните общение с ${currentChat ? currentChat.name : 'контактом'}</div>
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
