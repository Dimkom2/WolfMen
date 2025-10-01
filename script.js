// Инициализация Telegram Mini Apps
let tg = null;
try {
    tg = window.Telegram.WebApp;
} catch (error) {
    console.log('Telegram Web App не доступен');
    // Создаем заглушку для локального тестирования
    tg = {
        expand: function() { console.log('Telegram: expand') },
        ready: function() { console.log('Telegram: ready') }
    };
}

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
let unsubscribeMessages = null;
let db = null;

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    // Проверяем что Firebase загружен
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase не загружен!');
        showPage('login-page');
        return;
    }
    
    try {
        db = firebase.firestore();
        console.log('✅ Firestore подключен');
        
        // Тестируем подключение
        db.collection("test").limit(1).get().then(() => {
            console.log('✅ Подключение к Firebase успешно');
        }).catch(error => {
            console.warn('⚠️ Ограниченный доступ к Firebase:', error);
        });
        
    } catch (error) {
        console.error('❌ Ошибка Firestore:', error);
    }
    
    // Инициализация Telegram
    try {
        tg.expand();
        tg.ready();
    } catch (error) {
        console.log('Telegram не доступен, работаем в браузере');
    }
    
    // Переходим к авторизации
    setTimeout(() => {
        checkAuthOnLoad();
    }, 500);
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
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

function handleResize() {
    if (window.innerWidth > 768) {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').style.display = 'flex';
        document.querySelector('.header-back').style.display = 'none';
    } else {
        if (isChatOpen && currentChat) {
            document.querySelector('.contacts-panel').style.display = 'none';
            document.querySelector('.chat-window').style.display = 'flex';
        } else {
            document.querySelector('.contacts-panel').style.display = 'flex';
            document.querySelector('.chat-window').style.display = 'none';
        }
    }
}

// ПРОВЕРКА ПАРОЛЯ
function checkPassword() {
    console.log('=== checkPassword вызвана ===');
    
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
        
        // Сохраняем в оба хранилища
        sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
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
    initInterface();
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
        
        contactElement.innerHTML = `
            <div class="contact-avatar status-online">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">Нажмите чтобы начать общение</div>
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
    
    // Останавливаем предыдущую подписку
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    currentChat = contact;
    isChatOpen = true;
    
    document.getElementById('partnerAvatar').textContent = contact.login;
    document.getElementById('partnerName').textContent = contact.name;
    document.getElementById('partnerStatus').textContent = 'online';
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    loadChatHistory();
    handleResize();
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    const activeContact = document.querySelector(`[data-user-id="${contact.login}"]`);
    if (activeContact) {
        activeContact.classList.add('active');
    }
}

// ЗАГРУЗКА ИСТОРИИ ЧАТА ИЗ FIREBASE
function loadChatHistory() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '<div class="loading">Загрузка сообщений...</div>';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    // Проверяем доступность Firebase
    if (!db) {
        showWelcomeMessage();
        console.warn('Firebase не доступен, работаем в оффлайн режиме');
        return;
    }
    
    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        console.log('🔍 Загружаем чат:', chatKey);
        
        const q = db.collection("messages")
            .where("chatKey", "==", chatKey)
            .orderBy("timestamp", "asc");
        
        unsubscribeMessages = q.onSnapshot((snapshot) => {
            console.log('📨 Получены данные:', snapshot.size, 'сообщений');
            
            if (snapshot.empty) {
                showWelcomeMessage();
                return;
            }
            
            const messages = [];
            snapshot.forEach((doc) => {
                if (doc.exists) {
                    messages.push({ id: doc.id, ...doc.data() });
                }
            });
            
            displayMessages(messages);
            
        }, (error) => {
            console.error('❌ Ошибка загрузки:', error);
            showWelcomeMessage();
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        showWelcomeMessage();
    }
}

// КЛЮЧ ДЛЯ ЧАТА
function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ОТПРАВКА СООБЩЕНИЯ В FIREBASE
async function sendMessage() {
    if (!currentUser || !currentChat) {
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    if (!text) return;

    // Показываем сообщение сразу
    addMessageToUI(text, 'sent', getCurrentTime(), true);
    messageInput.value = '';

    // Проверяем доступность Firebase
    if (!db) {
        console.warn('Firebase не доступен, сообщение не сохранено');
        return;
    }

    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        
        // Сохраняем в Firebase
        await db.collection("messages").add({
            from: currentUser.chatId,
            fromName: currentUser.name,
            to: currentChat.chatId,
            toName: currentChat.name,
            text: text,
            chatKey: chatKey,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Сообщение сохранено в Firebase');
        
    } catch (error) {
        console.error('❌ Ошибка отправки:', error);
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
        const messageType = msg.from === currentUser.chatId ? 'sent' : 'received';
        const time = msg.timestamp ? formatFirebaseTime(msg.timestamp) : getCurrentTime();
        addMessageToUI(msg.text, messageType, time, false);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

function formatFirebaseTime(timestamp) {
    try {
        if (timestamp && timestamp.toDate) {
            const date = timestamp.toDate();
            return date.getHours().toString().padStart(2, '0') + ':' + 
                   date.getMinutes().toString().padStart(2, '0');
        }
    } catch (e) {
        console.error('Ошибка форматирования времени:', e);
    }
    return getCurrentTime();
}

function showWelcomeMessage() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatName = currentChat ? currentChat.name : 'контактом';
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-text">Начните общение с ${chatName}</div>
            <div class="welcome-subtext">Это начало вашей переписки</div>
        </div>
    `;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    handleResize();
}

function goBack() {
    if (window.innerWidth <= 768) {
        isChatOpen = false;
        handleResize();
    }
}

// ПРОВЕРКА АВТОРИЗАЦИИ
function checkAuthOnLoad() {
    try {
        let savedUser = sessionStorage.getItem('wolf_current_user') || localStorage.getItem('wolf_current_user');
        
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showPage('app');
            loadUserInterface();
        } else {
            showPage('login-page');
        }
    } catch (e) {
        sessionStorage.removeItem('wolf_current_user');
        localStorage.removeItem('wolf_current_user');
        showPage('login-page');
    }
}

// ВЫХОД
function logout() {
    currentUser = null;
    currentChat = null;
    isChatOpen = false;
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    sessionStorage.removeItem('wolf_current_user');
    localStorage.removeItem('wolf_current_user');
    showPage('login-page');
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
}

// Делаем функции глобальными
window.checkPassword = checkPassword;
window.sendMessage = sendMessage;
window.logout = logout;
window.goBack = goBack;
window.initApp = initApp;
window.loadChatHistory = loadChatHistory;
