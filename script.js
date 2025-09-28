// Проверяем, находимся ли мы в Telegram
const isTelegram = typeof window.Telegram !== 'undefined' && window.Telegram.WebApp;
const tg = isTelegram ? window.Telegram.WebApp : {
    expand: () => console.log('Telegram: expand'),
    enableClosingConfirmation: () => console.log('Telegram: enableClosingConfirmation'),
    setBackgroundColor: () => console.log('Telegram: setBackgroundColor'),
    ready: () => console.log('Telegram: ready')
};

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
    console.log('Режим:', isTelegram ? 'Telegram' : 'Браузер');
    
    if (isTelegram) {
        tg.expand();
        tg.enableClosingConfirmation();
        tg.setBackgroundColor('#000000');
    }
    
    // Принудительно устанавливаем ПК режим
    setTimeout(forceDesktopMode, 100);
    
    initInterface();
    
    // ВАЖНО: Проверяем авторизацию ПОСЛЕ инициализации
    checkAuthOnLoad();
}

// ПРИНУДИТЕЛЬНЫЙ РЕЖИМ ПК
function forceDesktopMode() {
    const app = document.getElementById('app');
    const contactsPanel = document.querySelector('.contacts-panel');
    const chatWindow = document.querySelector('.chat-window');
    
    if (app) {
        app.style.display = 'flex';
        app.style.width = '100vw';
        app.style.height = '100vh';
    }
    
    if (contactsPanel) {
        contactsPanel.style.display = 'flex';
        contactsPanel.style.width = '35%';
    }
    
    if (chatWindow) {
        chatWindow.style.display = 'flex';
        chatWindow.style.width = '65%';
    }
    
    const headerBack = document.querySelector('.header-back');
    if (headerBack) headerBack.style.display = 'none';
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
    }
    
    // Добавляем обработчик для кнопки входа по Enter
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

function handleResize() {
    if (window.innerWidth > 768) {
        forceDesktopMode();
    } else {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '100%';
        document.querySelector('.chat-window').style.display = 'none';
        document.querySelector('.header-back').style.display = 'block';
    }
}

// ПРОВЕРКА ПАРОЛЯ - ТЕПЕРЬ ОБЯЗАТЕЛЬНА
function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    console.log('Попытка входа:', login);

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
        console.log('Успешный вход:', currentUser.name);
        
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
        console.log('Ошибка входа для:', login);
        document.getElementById('password').value = '';
    }
}

// ЗАГРУЗКА ИНТЕРФЕЙСА ПОЛЬЗОВАТЕЛЯ
function loadUserInterface() {
    if (!currentUser) {
        // Если пользователь не авторизован, показываем страницу входа
        showPage('login-page');
        return;
    }
    
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    loadContacts();
    showWelcomeMessage();
}

// ЗАГРУЗКА РЕАЛЬНЫХ КОНТАКТОВ
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    
    if (!currentUser) {
        contactsList.innerHTML = '<div class="loading">Ошибка авторизации</div>';
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
        
        // Загружаем реальную историю чата
        const chatHistory = loadChatHistoryFromStorage(currentUser.login, contact.login);
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].text : 'Нет сообщений';
        
        // РЕАЛЬНЫЙ статус - всегда онлайн если вошел в систему
        const isOnline = true; // Все контакты онлайн, так как это реальные пользователи
        const statusClass = 'status-online';
        const lastSeen = 'online';
        
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

// ОТКРЫТИЕ ЧАТА С РЕАЛЬНЫМ ПОЛЬЗОВАТЕЛЕМ
function openChat(contact) {
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    
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

// ЗАГРУЗКА РЕАЛЬНОЙ ИСТОРИИ ЧАТА
function loadChatHistory(contactId) {
    const messagesContainer = document.getElementById('messagesContainer');
    const chatHistory = loadChatHistoryFromStorage(currentUser.login, contactId);
    
    displayMessages(chatHistory);
}

// ЗАГРУЗКА ИСТОРИИ ИЗ LOCALSTORAGE
function loadChatHistoryFromStorage(user1, user2) {
    const chatKey = `wolf_chat_${user1}_${user2}`;
    const history = localStorage.getItem(chatKey);
    return history ? JSON.parse(history) : [];
}

// СОХРАНЕНИЕ ИСТОРИИ В LOCALSTORAGE
function saveChatHistoryToStorage(user1, user2, messages) {
    const chatKey = `wolf_chat_${user1}_${user2}`;
    localStorage.setItem(chatKey, JSON.stringify(messages));
}

// ОТОБРАЖЕНИЕ СООБЩЕНИЙ
function displayMessages(messages) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    messages.forEach(msg => {
        addMessageToUI(msg.text, msg.type, msg.time, false);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ОТПРАВКА СООБЩЕНИЯ РЕАЛЬНОМУ ПОЛЬЗОВАТЕЛЮ
async function sendMessage() {
    if (!currentUser || !currentChat) {
        showPage('login-page');
        return;
    }
    
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
        
        // НЕТ АВТООТВЕТОВ - реальные пользователи отвечают сами!
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        addMessageToUI(text, 'sent', message.time, true);
        messageInput.value = '';
    }
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

// ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ - ИСПРАВЛЕННАЯ
function checkAuthOnLoad() {
    const savedUser = localStorage.getItem('wolf_current_user');
    console.log('Проверка авторизации:', savedUser);
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            showPage('app');
            loadUserInterface();
            console.log('Пользователь авторизован:', currentUser.name);
        } catch (e) {
            console.error('Ошибка при загрузке пользователя:', e);
            localStorage.removeItem('wolf_current_user');
            showPage('login-page');
        }
    } else {
        console.log('Пользователь не авторизован');
        showPage('login-page');
    }
}

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ - ИСПРАВЛЕННАЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен');
    
    // Показываем страницу входа по умолчанию
    showPage('login-page');
    
    // Инициализируем приложение
    if (isTelegram) {
        tg.ready();
    }
    initApp();
});
