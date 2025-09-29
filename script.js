// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

const CONFIG = {
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" }
    ]
};

let currentUser = null;
let currentChat = null;
let isChatOpen = false;
let messageHistory = {};

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Wolf Messenger для TMA...');
    
    tg.expand();
    tg.ready();
    
    initInterface();
    checkAuthOnLoad();
    loadAllChatHistory();
}

function initInterface() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        messageInput.addEventListener('focus', function() {
            if (window.innerWidth <= 768 && currentChat) {
                isChatOpen = true;
                showChatWindow();
            }
        });
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

function handleResize() {
    if (window.innerWidth > 768) {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '35%';
        document.querySelector('.chat-window').style.display = 'flex';
        document.querySelector('.chat-window').style.width = '65%';
        document.querySelector('.header-back').style.display = 'none';
    } else {
        const contactsPanel = document.querySelector('.contacts-panel');
        const chatWindow = document.querySelector('.chat-window');
        const headerBack = document.querySelector('.header-back');
        
        if (contactsPanel) contactsPanel.style.display = 'flex';
        if (headerBack) headerBack.style.display = 'block';
        
        if (chatWindow) {
            if (isChatOpen && currentChat) {
                chatWindow.style.display = 'flex';
                if (contactsPanel) contactsPanel.style.display = 'none';
            } else {
                chatWindow.style.display = 'none';
                if (contactsPanel) contactsPanel.style.display = 'flex';
            }
        }
    }
}

// ПРОВЕРКА ПАРОЛЯ
function checkPassword() {
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
        document.getElementById('password').value = '';
    }
}

// ЗАГРУЗКА ИНТЕРФЕЙСА
function loadUserInterface() {
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    loadContacts();
}

// ЗАГРУЗКА КОНТАКТОВ
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!currentUser || !contactsList) return;
    
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
        
        const chatKey = getChatKey(currentUser.chatId, contact.chatId);
        const lastMessage = messageHistory[chatKey] && messageHistory[chatKey].length > 0 
            ? messageHistory[chatKey][messageHistory[chatKey].length - 1].text 
            : 'Нет сообщений';
        
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
    isChatOpen = true;
    
    document.getElementById('partnerAvatar').textContent = contact.login;
    document.getElementById('partnerName').textContent = contact.name;
    document.getElementById('partnerStatus').textContent = 'online';
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    loadChatHistory();
    
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`).classList.add('active');
}

// КЛЮЧ ДЛЯ ЧАТА
function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ЗАГРУЗКА ВСЕЙ ИСТОРИИ ЧАТОВ
function loadAllChatHistory() {
    try {
        const savedHistory = localStorage.getItem('wolf_chat_history');
        if (savedHistory) {
            messageHistory = JSON.parse(savedHistory);
        }
    } catch (e) {
        messageHistory = {};
    }
}

// СОХРАНЕНИЕ ИСТОРИИ ЧАТОВ
function saveAllChatHistory() {
    localStorage.setItem('wolf_chat_history', JSON.stringify(messageHistory));
}

// ЗАГРУЗКА ИСТОРИИ КОНКРЕТНОГО ЧАТА
function loadChatHistory() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
    const history = messageHistory[chatKey] || [];
    
    messagesContainer.innerHTML = '';
    
    if (history.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    history.forEach(msg => {
        addMessageToUI(msg.text, msg.sender === currentUser.chatId ? 'sent' : 'received', msg.time, false);
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
        sender: currentUser.chatId,
        receiver: currentChat.chatId,
        time: getCurrentTime(),
        type: 'sent'
    };

    // Сохраняем сообщение в историю
    const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
    if (!messageHistory[chatKey]) {
        messageHistory[chatKey] = [];
    }
    messageHistory[chatKey].push(message);
    saveAllChatHistory();
    
    // Показываем в интерфейсе
    addMessageToUI(text, 'sent', message.time, true);
    messageInput.value = '';
    
    // Обновляем последнее сообщение в списке контактов
    updateLastMessage(currentChat.chatId, text);
    
    // Отправляем уведомление через Telegram Bot (опционально)
    sendTelegramNotification(message);
}

// ОТПРАВКА УВЕДОМЛЕНИЯ ЧЕРЕЗ БОТА
function sendTelegramNotification(message) {
    try {
        const notificationData = {
            action: 'new_message',
            from: currentUser.name,
            to: currentChat.name, 
            text: message.text,
            chat_key: getChatKey(currentUser.chatId, currentChat.chatId)
        };
        
        // Отправляем данные боту (если нужно)
        tg.sendData(JSON.stringify(notificationData));
        console.log('Уведомление отправлено боту:', notificationData);
        
    } catch (error) {
        console.log('Уведомление не отправлено (бот не настроен)');
    }
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
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    handleResize();
}

function goBack() {
    if (window.innerWidth <= 768) {
        isChatOpen = false;
        hideChatWindow();
    }
}

function showChatWindow() {
    isChatOpen = true;
    document.querySelector('.contacts-panel').style.display = 'none';
    document.querySelector('.chat-window').style.display = 'flex';
}

function hideChatWindow() {
    isChatOpen = false;
    document.querySelector('.contacts-panel').style.display = 'flex';
    document.querySelector('.chat-window').style.display = 'none';
}

// ПРОВЕРКА АВТОРИЗАЦИИ
function checkAuthOnLoad() {
    try {
        const savedUser = localStorage.getItem('wolf_current_user');
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

// ВЫХОД
function logout() {
    currentUser = null;
    currentChat = null;
    isChatOpen = false;
    localStorage.removeItem('wolf_current_user');
    showPage('login-page');
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});
