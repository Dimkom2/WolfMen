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
    
    // Инициализация Telegram Web App (с проверкой поддержки функций)
    try {
        tg.expand();
        console.log('TMA: expand успешно');
    } catch (e) {
        console.log('TMA: expand не поддерживается');
    }
    
    try {
        tg.enableClosingConfirmation();
        console.log('TMA: enableClosingConfirmation успешно');
    } catch (e) {
        console.log('TMA: enableClosingConfirmation не поддерживается');
    }
    
    try {
        tg.setBackgroundColor('#000000');
        console.log('TMA: setBackgroundColor успешно');
    } catch (e) {
        console.log('TMA: setBackgroundColor не поддерживается');
    }
    
    tg.ready();
    console.log('TMA: ready вызван');
    
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
    
    // Добавляем обработчик для кнопки входа по Enter
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                console.log('Нажата Enter в поле пароля');
                checkPassword();
            }
        });
    }
    
    // Добавляем обработчик для кнопки входа
    const loginButton = document.querySelector('.login-button');
    if (loginButton) {
        loginButton.addEventListener('click', function() {
            console.log('Нажата кнопка Войти');
            checkPassword();
        });
    }
    
    // Принудительно устанавливаем ПК режим для TMA
    setTimeout(forceDesktopMode, 100);
}

// ПРИНУДИТЕЛЬНЫЙ РЕЖИМ ПК ДЛЯ TMA
function forceDesktopMode() {
    console.log('Применение PC режима...');
    const contactsPanel = document.querySelector('.contacts-panel');
    const chatWindow = document.querySelector('.chat-window');
    
    if (contactsPanel) {
        contactsPanel.style.display = 'flex';
        contactsPanel.style.width = '35%';
        console.log('Панель контактов настроена');
    }
    
    if (chatWindow) {
        chatWindow.style.display = 'flex';
        chatWindow.style.width = '65%';
        console.log('Окно чата настроено');
    }
    
    const headerBack = document.querySelector('.header-back');
    if (headerBack) headerBack.style.display = 'none';
}

// ПРОВЕРКА ПАРОЛЯ
function checkPassword() {
    console.log('=== ФУНКЦИЯ checkPassword ВЫЗВАНА ===');
    
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    console.log('Введен логин:', login);
    console.log('Введен пароль:', password);

    // Проверяем есть ли логин и пароль
    if (!login || !password) {
        console.log('Ошибка: логин или пароль пустые');
        errorMessage.textContent = 'ОШИБКА: Введите логин и пароль';
        return;
    }

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
        
        console.log('Сохранение пользователя в localStorage:', currentUser);
        localStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        // Проверяем что сохранилось
        const saved = localStorage.getItem('wolf_current_user');
        console.log('Проверка сохранения:', saved);
        
        showPage('app');
        loadUserInterface();
        console.log('Переход на главную страницу');
        
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
        console.log('Ошибка: currentUser не определен');
        showPage('login-page');
        return;
    }
    
    console.log('Текущий пользователь:', currentUser);
    
    const currentUserAvatar = document.getElementById('currentUserAvatar');
    const currentUserName = document.getElementById('currentUserName');
    const currentUserStatus = document.getElementById('currentUserStatus');
    
    if (currentUserAvatar) {
        currentUserAvatar.textContent = currentUser.login;
        console.log('Аватар установлен:', currentUser.login);
    }
    if (currentUserName) {
        currentUserName.textContent = currentUser.name;
        console.log('Имя установлено:', currentUser.name);
    }
    if (currentUserStatus) {
        currentUserStatus.textContent = 'online';
        console.log('Статус установлен: online');
    }
    
    loadContacts();
}

// ЗАГРУЗКА КОНТАКТОВ
function loadContacts() {
    console.log('Загрузка контактов...');
    const contactsList = document.getElementById('contactsList');
    
    if (!currentUser || !contactsList) {
        console.log('Ошибка: нет currentUser или contactsList');
        return;
    }
    
    const contacts = CONFIG.validAccounts.filter(acc => acc.login !== currentUser.login);
    console.log('Доступные контакты:', contacts);
    
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
        
        contactElement.addEventListener('click', () => {
            console.log('Клик по контакту:', contact.name);
            openChat(contact);
        });
        contactsList.appendChild(contactElement);
    });
    
    console.log('Контакты загружены');
}

// ОТКРЫТИЕ ЧАТА
function openChat(contact) {
    console.log('Открытие чата с:', contact.name);
    
    if (!currentUser) {
        console.log('Ошибка: пользователь не авторизован');
        showPage('login-page');
        return;
    }
    
    currentChat = contact;
    console.log('Текущий чат установлен:', currentChat);
    
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
    
    console.log('Интерфейс чата настроен');
    
    loadChatHistory(contact.login);
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    const activeContact = document.querySelector(`[data-user-id="${contact.login}"]`);
    if (activeContact) activeContact.classList.add('active');
}

// ЗАГРУЗКА ИСТОРИИ ЧАТА
function loadChatHistory(contactId) {
    console.log('Загрузка истории чата с:', contactId);
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatHistory = loadChatHistoryFromStorage(currentUser.login, contactId);
    console.log('Загружено сообщений:', chatHistory.length);
    displayMessages(chatHistory);
}

// ЗАГРУЗКА ИСТОРИИ ИЗ LOCALSTORAGE
function loadChatHistoryFromStorage(user1, user2) {
    const chatKey = `wolf_chat_${[user1, user2].sort().join('_')}`;
    try {
        const history = localStorage.getItem(chatKey);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error('Ошибка загрузки истории:', e);
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
    console.log('Отправка сообщения...');
    
    if (!currentUser || !currentChat) {
        console.log('Ошибка: нет пользователя или чата');
        showPage('login-page');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    if (!text) return;

    console.log('Текст сообщения:', text);

    const message = {
        text: text,
        sender: currentUser.login,
        receiver: currentChat.login,
        time: getCurrentTime(),
        type: 'sent'
    };
    
    // Сохраняем в историю
    saveMessageToHistory(currentUser.login, currentChat.login, message);
    
    // Добавляем в интерфейс
    addMessageToUI(text, 'sent', message.time, true);
    messageInput.value = '';
    
    // Обновляем последнее сообщение
    updateLastMessage(currentChat.login, text);
    
    console.log('Сообщение отправлено');
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
    console.log('Переключение на страницу:', pageId);
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.classList.add('active');
        console.log('Страница активирована:', pageId);
    }
    
    // Принудительно обновляем режим отображения для TMA
    setTimeout(forceDesktopMode, 50);
}

function goBack() {
    // В TMA всегда показываем обе панели
    forceDesktopMode();
}

function showChatWindow() {
    // В TMA всегда показываем обе панели
    forceDesktopMode();
}

function hideChatWindow() {
    // В TMA всегда показываем обе панели
    forceDesktopMode();
}

// ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ
function checkAuthOnLoad() {
    try {
        const savedUser = localStorage.getItem('wolf_current_user');
        console.log('Проверка авторизации в TMA:', savedUser);
        
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            console.log('Пользователь найден:', currentUser);
            showPage('app');
            loadUserInterface();
            console.log('Пользователь авторизован в TMA:', currentUser.name);
        } else {
            console.log('Пользователь не авторизован в TMA');
            showPage('login-page');
        }
    } catch (e) {
        console.error('Ошибка при проверке авторизации в TMA:', e);
        localStorage.removeItem('wolf_current_user');
        showPage('login-page');
    }
}

// ФУНКЦИЯ ВЫХОДА ДЛЯ TMA
function logout() {
    console.log('Выход из системы...');
    currentUser = null;
    currentChat = null;
    localStorage.removeItem('wolf_current_user');
    showPage('login-page');
    
    // Очищаем поля ввода
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
    console.log('Выход завершен');
}

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ДЛЯ TMA
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM ЗАГРУЖЕН ДЛЯ TMA ===');
    initApp();
});
