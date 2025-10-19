// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

const CONFIG = {
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" },
        { login: "947", password: "SigmaUbiyca654@", name: "Агент 947", chatId: "947" },
        { login: "993", password: "KolynKolyan@", name: "Агент 993", chatId: "993" }
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
    
    // Проверяем онлайн статус
    if (!navigator.onLine) {
        console.warn('⚠️ Приложение запущено в оффлайн режиме');
    }
    
    // Проверяем что Firebase загружен
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase не загружен!');
        showPage('login-page');
        return;
    }
    
    try {
        // Инициализируем Firestore
        db = firebase.firestore();
        
        // Настраиваем кэш для оффлайн работы
        db.enablePersistence()
            .then(() => {
                console.log('✅ Оффлайн поддержка включена');
            })
            .catch((err) => {
                console.warn('⚠️ Оффлайн режим не доступен:', err);
            });
        
        console.log('✅ Firestore инициализирован');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации Firestore:', error);
    }
    
    // Инициализация Telegram
    tg.expand();
    tg.ready();
    
    // Инициализируем интерфейс
    initInterface();
    
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
        
        // Сохраняем в sessionStorage для текущей сессии
        sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        // Также сохраняем в Firebase для отслеживания онлайн статуса
        updateUserStatus(true);
        
        showPage('app');
        loadUserInterface();
        
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
        document.getElementById('password').value = '';
    }
}

// ОБНОВЛЕНИЕ СТАТУСА ПОЛЬЗОВАТЕЛЯ В FIREBASE
async function updateUserStatus(isOnline) {
    if (!db || !currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.chatId).set({
            name: currentUser.name,
            login: currentUser.login,
            isOnline: isOnline,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Статус обновлен в Firebase');
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
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

// ЗАГРУЗКА КОНТАКТОВ С ОНЛАЙН СТАТУСОМ
function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!currentUser || !contactsList) return;
    
    const contacts = CONFIG.validAccounts.filter(acc => acc.login !== currentUser.login);
    
    if (contacts.length === 0) {
        contactsList.innerHTML = '<div class="loading">Нет доступных контактов</div>';
        return;
    }
    
    contactsList.innerHTML = '<div class="loading">Загрузка контактов...</div>';
    
    // Загружаем онлайн статусы из Firebase
    loadOnlineStatuses(contacts).then(contactsWithStatus => {
        displayContacts(contactsWithStatus);
    }).catch(error => {
        console.error('Ошибка загрузки статусов:', error);
        displayContacts(contacts); // Показываем контакты без статусов
    });
}

// ЗАГРУЗКА ОНЛАЙН СТАТУСОВ ИЗ FIREBASE
async function loadOnlineStatuses(contacts) {
    if (!db) return contacts;
    
    try {
        const userIds = contacts.map(contact => contact.chatId);
        const snapshot = await db.collection('users')
            .where(firebase.firestore.FieldPath.documentId(), 'in', userIds)
            .get();
            
        const userStatuses = {};
        snapshot.forEach(doc => {
            userStatuses[doc.id] = doc.data().isOnline || false;
        });
        
        // Обновляем контакты со статусами
        return contacts.map(contact => ({
            ...contact,
            isOnline: userStatuses[contact.chatId] || false
        }));
        
    } catch (error) {
        console.error('Ошибка загрузки статусов:', error);
        return contacts;
    }
}

// ОТОБРАЖЕНИЕ КОНТАКТОВ
function displayContacts(contacts) {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    contactsList.innerHTML = '';
    
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = 'contact';
        contactElement.dataset.userId = contact.login;
        
        const statusClass = contact.isOnline ? 'status-online' : 'status-offline';
        const statusText = contact.isOnline ? 'online' : 'offline';
        
        contactElement.innerHTML = `
            <div class="contact-avatar ${statusClass}">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${statusText}</div>
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
    document.getElementById('partnerStatus').textContent = contact.isOnline ? 'online' : 'offline';
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    
    loadChatHistory();
    
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`).classList.add('active');
}

// УПРОЩЕННАЯ ЗАГРУЗКА ИСТОРИИ ЧАТА (без индексов)
function loadChatHistory() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer || !currentUser || !currentChat) return;
    
    messagesContainer.innerHTML = '<div class="loading">Загрузка сообщений...</div>';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        
        console.log('📥 Загружаем историю для чата:', chatKey);
        
        // Загружаем ВСЕ сообщения и фильтруем локально
        const q = db.collection("messages");
        
        unsubscribeMessages = q.onSnapshot((snapshot) => {
            const allMessages = [];
            snapshot.forEach((doc) => {
                if (doc.exists) {
                    allMessages.push({ id: doc.id, ...doc.data() });
                }
            });
            
            // Фильтруем сообщения по chatKey локально
            const chatMessages = allMessages.filter(msg => msg.chatKey === chatKey);
            
            // Сортируем по timestamp
            chatMessages.sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                return timeA - timeB;
            });
            
            console.log('📨 Загружено сообщений для чата:', chatMessages.length);
            
            if (chatMessages.length === 0) {
                showWelcomeMessage();
            } else {
                displayMessages(chatMessages);
            }
            
        }, (error) => {
            console.error('❌ Ошибка загрузки:', error);
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-text">Ошибка загрузки сообщений</div>
                    <div class="welcome-subtext">${error.message}</div>
                    <button onclick="loadChatHistory()" style="margin-top: 10px; padding: 8px 16px; background: #333; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Попробовать снова
                    </button>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('❌ Ошибка настройки слушателя:', error);
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-text">Ошибка подключения</div>
                <div class="welcome-subtext">${error.message}</div>
            </div>
        `;
    }
}

// КЛЮЧ ДЛЯ ЧАТА
function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ОТПРАВКА СООБЩЕНИЯ В FIREBASE
async function sendMessage() {
    if (!currentUser || !currentChat || !db) {
        showPage('login-page');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    if (!text) return;

    // Показываем сообщение сразу (оптимистичное обновление)
    const tempId = 'temp_' + Date.now();
    addMessageToUI(text, 'sent', getCurrentTime(), tempId, true);
    messageInput.value = '';

    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // Сохраняем в Firebase
        const docRef = await db.collection("messages").add({
            from: currentUser.chatId,
            fromName: currentUser.name,
            to: currentChat.chatId,
            toName: currentChat.name,
            text: text,
            chatKey: chatKey,
            timestamp: timestamp
        });
        
        console.log('✅ Сообщение сохранено в Firebase с ID:', docRef.id);
        
        // Удаляем временное сообщение
        const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempElement) {
            tempElement.remove();
        }
        
    } catch (error) {
        console.error('❌ Ошибка отправки:', error);
        
        // Помечаем сообщение как ошибку
        const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempElement) {
            tempElement.classList.add('error');
            tempElement.querySelector('.message-text').textContent = '❌ Ошибка отправки: ' + text;
        }
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
        addMessageToUI(msg.text, messageType, time, msg.id, false);
    });
    
    scrollToBottom();
}

// ДОБАВЛЕНИЕ СООБЩЕНИЯ В ИНТЕРФЕЙС
function addMessageToUI(text, type, time, messageId, shouldScroll = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.dataset.messageId = messageId;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    if (shouldScroll) {
        scrollToBottom();
    }
}

// ПРОКРУТКА ВНИЗ
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

function formatFirebaseTime(timestamp) {
    if (timestamp && timestamp.toDate) {
        const date = timestamp.toDate();
        return date.getHours().toString().padStart(2, '0') + ':' + 
               date.getMinutes().toString().padStart(2, '0');
    }
    return getCurrentTime();
}

function showWelcomeMessage() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const chatName = currentChat ? currentChat.name : 'контактом';
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <img src="wolf-logo.png" alt="Wolf" class="welcome-logo">
            <div class="welcome-text">Начните общение с ${chatName}</div>
            <div class="welcome-subtext">Сообщения сохраняются глобально в Firebase</div>
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
        const savedUser = sessionStorage.getItem('wolf_current_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showPage('app');
            loadUserInterface();
            
            // Обновляем статус онлайн
            updateUserStatus(true);
        } else {
            showPage('login-page');
        }
    } catch (e) {
        console.error('Ошибка восстановления сессии:', e);
        sessionStorage.removeItem('wolf_current_user');
        showPage('login-page');
    }
}

// ВЫХОД
async function logout() {
    // Обновляем статус в Firebase
    if (currentUser) {
        await updateUserStatus(false);
    }
    
    currentUser = null;
    currentChat = null;
    isChatOpen = false;
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    sessionStorage.removeItem('wolf_current_user');
    showPage('login-page');
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
}

// ОБРАБОТЧИК ПЕРЕЗАГРУЗКИ СТРАНИЦЫ
window.addEventListener('beforeunload', function() {
    if (currentUser) {
        updateUserStatus(false);
    }
});

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запуск приложения...');
    window.initApp = initApp;
});




