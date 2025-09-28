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
    console.log('🚀 Инициализация Wolf Messenger для TMA...');
    
    // Инициализация Telegram Web App
    tg.expand();
    tg.ready();
    
    initInterface();
    checkAuthOnLoad();
}

function initInterface() {
    console.log('Инициализация интерфейса...');
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

function handleResize() {
    if (window.innerWidth > 768) {
        // PC режим
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '35%';
        document.querySelector('.chat-window').style.display = 'flex';
        document.querySelector('.chat-window').style.width = '65%';
        document.querySelector('.header-back').style.display = 'none';
    } else {
        // Мобильный режим
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '100%';
        document.querySelector('.chat-window').style.display = 'none';
        document.querySelector('.header-back').style.display = 'block';
    }
}

// ПРОВЕРКА ПАРОЛЯ
function checkPassword() {
    console.log('=== ФУНКЦИЯ checkPassword ВЫЗВАНА ===');
    
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    console.log('Введен логин:', login);
    console.log('Введен пароль:', password);

    const isValid = CONFIG.validAccounts.find(acc => acc.login === login && acc.password === password);
    console.log('Найден аккаунт:', isValid);

    if (isValid) {
        console.log('✅ Авторизация успешна!');
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
        console.log('❌ Ошибка авторизации');
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
        document.getElementById('password').value = '';
    }
}

// ЗАГРУЗКА ИНТЕРФЕЙСА ПОЛЬЗОВАТЕЛЯ
function loadUserInterface() {
    console.log('Загрузка интерфейса пользователя...');
    
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    
    const currentUserAvatar = document.getElementById('currentUserAvatar');
    const currentUserName = document.getElementById('currentUserName');
    const currentUserStatus = document.getElementById('currentUserStatus');
    
    if (currentUserAvatar) currentUserAvatar.textContent = currentUser.login;
    if (currentUserName) currentUserName.textContent = currentUser.name;
    if (currentUserStatus) currentUserStatus.textContent = 'online';
    
    loadContacts();
}

// ЗАГРУЗКА КОНТАКТОВ
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    
    if (!currentUser || !contactsList) {
        return;
    }
    
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
        
        const chatHistory = loadChatHistoryFromStorage(currentUser.login, contact.login);
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].text : 'Нет сообщений';
        
        contactElement.innerHTML = `
            <div class="contact-avatar status-online">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${lastMessage}</div>
            </div>
        `;
        
        contactElement.addEventListener('click', () => openChat(contact));
        contactsList.appendChild(contactElement);
    });
}

// ОТКРЫТИЕ ЧАТА
function openChat(contact) {
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    
    currentChat = contact;
    
    const partnerAvatar = document.getElementById('partnerAvatar');
    const partnerName = document.getElementById('partnerName');
    const partnerStatus = document.getElementById('partnerStatus');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.querySelector('.send-button');
    
    if (partnerAvatar) partnerAvatar.textContent = contact.login;
    if (partnerName) partnerName.textContent = contact.name;
    if (partnerStatus) partnerStatus.textContent = 'online';
    if (messageInput) messageInput.disabled = false;
    if (sendButton) sendButton.disabled = false;
    
    loadChatHistory(contact.login);
    
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    const activeContact = document.querySelector(`[data-user-id="${contact.login}"]`);
    if (activeContact) activeContact.classList.add('active');
}

// ЗАГРУЗКА ИСТОРИИ ЧАТА
function loadChatHistory(contactId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatHistory = loadChatHistoryFromStorage(currentUser.login, contactId);
    displayMessages(chatHistory);
}

// ЗАГРУЗКА ИСТОРИИ ИЗ LOCALSTORAGE
function loadChatHistoryFromStorage(user1, user2) {
    const chatKey = `wolf_chat_${[user1, user2].sort().join('_')}`;
    try {
        const history = localStorage.getItem(chatKey);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        return [];
    }
}

// СОХРАНЕНИЕ ИСТОРИИ В LOCALSTORAGE
function saveChatHistoryToStorage(user1, user2, messages) {
    const chatKey = `wolf_chat_${[user1, user2].sort().join('_')}`;
    try {
        localStorage.setItem(chatKey, JSON.stringify(messages));
    } catch (e) {
        console.error('Ошибка сохранения истории:', e);
    }
}

// ОТОБРАЖЕНИЕ СООБЩЕНИЙ
function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    messages.forEach(msg => {
        addMessageToUI(msg.text, msg.sender === currentUser.login ? 'sent' : 'received', msg.time, false);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ОТПРАВКА СООБЩЕНИЯ
function sendMessage() {
    if (!currentUser || !currentChat) {
        showPage('login-page');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    if (!text) return;

    const message = {
        text: text,
        sender: currentUser.login,
        receiver: currentChat.login,
        time: getCurrentTime(),
        type: 'sent'
    };
    
    saveMessageToHistory(currentUser.login, currentChat.login, message);
    addMessageToUI(text, 'sent', message.time, true);
    messageInput.value = '';
    updateLastMessage(currentChat.login, text);
}

// СОХРАНЕНИЕ СООБЩЕНИЯ В ИСТОРИЮ
function saveMessageToHistory(user1, user2, message) {
    const history = loadChatHistoryFromStorage(user1, user2);
    history.push(message);
    saveChatHistoryToStorage(user1, user2, history);
}

// ДОБАВЛЕНИЕ СООБЩЕНИЯ В ИНТЕРФЕЙС
function addMessageToUI(text, type, time, shouldScroll = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
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

// ОБНОВЛЕНИЕ ПОСЛЕДНЕГО СООБЩЕНИЯ
function updateLastMessage(contactId, message) {
    const contactElement = document.querySelector(`[data-user-id="${contactId}"]`);
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message;
        }
    }
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

function showWelcomeMessage() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatName = currentChat ? currentChat.name : 'контактом';
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <img src="wolf-logo.png" alt="Wolf" class="welcome-logo">
            <div class="welcome-text">Начните общение с ${chatName}</div>
            <div class="welcome-subtext">Сообщения сохраняются локально</div>
        </div>
    `;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    handleResize();
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

// ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ
function checkAuthOnLoad() {
    try {
        const savedUser = localStorage.getItem('wolf_current_user');
        console.log('Проверка авторизации в TMA:', savedUser);
        
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showPage('app');
            loadUserInterface();
        } else {
            showPage('login-page');
        }
    } catch (e) {
        localStorage.removeItem('wolf_current_user');
        showPage('login-page');
    }
}

// ФУНКЦИЯ ВЫХОДА ДЛЯ TMA
function logout() {
    currentUser = null;
    currentChat = null;
    localStorage.removeItem('wolf_current_user');
    showPage('login-page');
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
}

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ДЛЯ TMA
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен для TMA');
    initApp();
});
