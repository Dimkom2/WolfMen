// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Конфигурация аккаунтов (только для аутентификации)
const CONFIG = {
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" },
        { login: "836", password: "Pchela836@", name: "Агент 836", chatId: "836" },
        { login: "456", password: "Utka2021@", name: "Агент 456", chatId: "456" },
        { login: "947", password: "SigmaUbiyca654@", name: "Агент 947", chatId: "947" }
    ],
    adminLogins: ["247", "001"]  // кто может выполнять /add
};

let currentUser = null;
let currentChat = null;
let isChatOpen = false;
let unsubscribeMessages = null;
let db = null;

// Инициализация приложения
function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    if (!navigator.onLine) {
        console.warn('⚠️ Приложение запущено в оффлайн режиме');
    }
    
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase не загружен!');
        showPage('login-page');
        return;
    }
    
    try {
        db = firebase.firestore();
        db.enablePersistence()
            .then(() => console.log('✅ Оффлайн поддержка включена'))
            .catch((err) => console.warn('⚠️ Оффлайн режим не доступен:', err));
        console.log('✅ Firestore инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firestore:', error);
    }
    
    tg.expand();
    tg.ready();
    
    initInterface();
    
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

// Проверка пароля
function checkPassword() {
    console.log('=== checkPassword вызвана ===');
    
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    let foundAccount = null;
    for (let acc of CONFIG.validAccounts) {
        if (acc.login === login && acc.password === password) {
            foundAccount = acc;
            break;
        }
    }

    if (foundAccount) {
        errorMessage.textContent = '';
        currentUser = {
            login: foundAccount.login,
            name: foundAccount.name,
            chatId: foundAccount.chatId,
            isAdmin: CONFIG.adminLogins.includes(foundAccount.login)
        };
        
        console.log('✅ Создан currentUser:', currentUser);
        
        sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        // Инициализируем запись пользователя в Firebase и обрабатываем возможные ошибки
        initUserInFirebase()
            .then(() => {
                updateUserStatus(true);
                showPage('app');
                loadUserInterface();
            })
            .catch((error) => {
                console.error('❌ Ошибка инициализации:', error);
                errorMessage.textContent = 'Ошибка подключения к серверу. Попробуйте позже.';
                currentUser = null;
                sessionStorage.removeItem('wolf_current_user');
            });
    } else {
        console.log('❌ АККАУНТ НЕ НАЙДЕН');
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
        document.getElementById('password').value = '';
    }
}

// Создание/обновление пользователя и его контактов в Firebase
async function initUserInFirebase() {
    if (!db || !currentUser) return;
    
    try {
        // Запись в коллекцию users (информация о пользователе)
        await db.collection('users').doc(currentUser.chatId).set({
            name: currentUser.name,
            login: currentUser.login,
            isAdmin: currentUser.isAdmin,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Создаём пустой список контактов, если его нет
        const contactRef = db.collection('contacts').doc(currentUser.chatId);
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) {
            await contactRef.set({
                userId: currentUser.chatId,
                contacts: [], // пустой массив
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        console.log('✅ Пользователь инициализирован в Firebase');
        
        // Добавляем начальные контакты (247 и Организатор) и ждём завершения
        await ensureInitialContacts();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации пользователя:', error);
        throw error; // Пробрасываем ошибку дальше
    }
}

// Добавление начальной связи между 247 и Организатором
async function ensureInitialContacts() {
    if (!currentUser) return;
    
    const initialPairs = [
        ["247", "001"]  // Агент 247 и Организатор
    ];
    
    for (let [loginA, loginB] of initialPairs) {
        if (currentUser.login === loginA || currentUser.login === loginB) {
            const accountA = CONFIG.validAccounts.find(acc => acc.login === loginA);
            const accountB = CONFIG.validAccounts.find(acc => acc.login === loginB);
            if (accountA && accountB) {
                try {
                    const contactRef = db.collection('contacts').doc(currentUser.chatId);
                    const doc = await contactRef.get();
                    if (doc.exists) {
                        const contacts = doc.data().contacts || [];
                        const otherId = (currentUser.login === loginA) ? accountB.chatId : accountA.chatId;
                        if (!contacts.includes(otherId)) {
                            // Добавляем двустороннюю связь
                            await addContact(currentUser.chatId, otherId);
                            await addContact(otherId, currentUser.chatId);
                            console.log(`✅ Добавлена начальная связь между ${loginA} и ${loginB}`);
                        }
                    }
                } catch (error) {
                    console.error('Ошибка при добавлении начальных контактов:', error);
                    // Не пробрасываем, чтобы не блокировать вход, но логируем
                }
            }
            break; // только одна пара
        }
    }
}

// Обновление статуса онлайн
async function updateUserStatus(isOnline) {
    if (!db || !currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.chatId).set({
            isOnline: isOnline,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('✅ Статус обновлен в Firebase');
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
    }
}

// Загрузка интерфейса пользователя
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

// Загрузка контактов пользователя из Firebase
async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!currentUser || !contactsList) return;
    
    contactsList.innerHTML = '<div class="loading">Загрузка контактов...</div>';
    
    try {
        const contactDoc = await db.collection('contacts').doc(currentUser.chatId).get();
        if (!contactDoc.exists) {
            contactsList.innerHTML = '<div class="loading">У вас пока нет контактов</div>';
            return;
        }
        
        const contactIds = contactDoc.data().contacts || [];
        if (contactIds.length === 0) {
            contactsList.innerHTML = '<div class="loading">У вас пока нет контактов</div>';
            return;
        }
        
        const contactsData = [];
        for (let id of contactIds) {
            const userDoc = await db.collection('users').doc(id).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                contactsData.push({
                    chatId: id,
                    login: userData.login,
                    name: userData.name,
                    isOnline: userData.isOnline || false
                });
            } else {
                console.warn(`Пользователь с id ${id} не найден в коллекции users, но есть в контактах`);
            }
        }
        
        displayContacts(contactsData);
    } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
        contactsList.innerHTML = '<div class="loading">Ошибка загрузки контактов</div>';
    }
}

// Отображение контактов
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

// Открытие чата
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
    document.querySelector(`[data-user-id="${contact.login}"]`)?.classList.add('active');
}

// Загрузка истории чата
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
        
        const q = db.collection("messages");
        
        unsubscribeMessages = q.onSnapshot((snapshot) => {
            const allMessages = [];
            snapshot.forEach((doc) => {
                if (doc.exists) {
                    allMessages.push({ id: doc.id, ...doc.data() });
                }
            });
            
            const chatMessages = allMessages.filter(msg => msg.chatKey === chatKey);
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

// Ключ чата
function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Обработка команд
function handleCommand(message) {
    // Команда /soglasie
    if (message === '/soglasie' || message === '/согласие' || message === '/соглашение') {
        showAgreement();
        return true;
    }
    
    // Команда /add логин1 логин2 (только для админов)
    if (message.startsWith('/add ')) {
        if (currentUser && currentUser.isAdmin) {
            handleAddCommand(message);
        } else {
            alert('Только администраторы могут добавлять контакты');
        }
        return true;
    }
    
    return false;
}

// Обработка команды /add логин1 логин2
async function handleAddCommand(message) {
    const parts = message.split(' ').filter(p => p.trim() !== '');
    if (parts.length !== 3) {
        alert('Использование: /add логин1 логин2');
        return;
    }
    
    const login1 = parts[1];
    const login2 = parts[2];
    
    if (login1 === login2) {
        alert('Нельзя добавить пользователя самого к себе');
        return;
    }
    
    const account1 = CONFIG.validAccounts.find(acc => acc.login === login1);
    const account2 = CONFIG.validAccounts.find(acc => acc.login === login2);
    
    if (!account1 || !account2) {
        alert('Один из логинов не существует');
        return;
    }
    
    try {
        // Добавляем двустороннюю связь
        await addContact(account1.chatId, account2.chatId);
        await addContact(account2.chatId, account1.chatId);
        
        if (currentUser.chatId === account1.chatId || currentUser.chatId === account2.chatId) {
            loadContacts();
        }
        
        alert(`Контакты ${login1} и ${login2} теперь видят друг друга`);
    } catch (error) {
        console.error('Ошибка добавления контактов:', error);
        alert('Ошибка при добавлении контактов');
    }
}

// Вспомогательная функция для добавления одного контакта
async function addContact(userId, contactId) {
    const contactRef = db.collection('contacts').doc(userId);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(contactRef);
        if (!doc.exists) {
            transaction.set(contactRef, { 
                userId: userId, 
                contacts: [contactId],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const contacts = doc.data().contacts || [];
            if (!contacts.includes(contactId)) {
                contacts.push(contactId);
                transaction.update(contactRef, { 
                    contacts: contacts,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    });
}

// Показать соглашение (текст сокращён для экономии места, в реальном коде он полный)
function showAgreement() {
    const agreementText = `СОГЛАШЕНИЕ ОБ ИСПОЛЬЗОВАНИИ СЕРВИСА WOLF MESSENGER\n\n... (полный текст соглашения) ...`;
    // ... код модального окна (без изменений) ...
}

// Отправка сообщения
async function sendMessage() {
    if (!currentUser || !currentChat || !db) {
        showPage('login-page');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const text = messageInput.value.trim();
    if (!text) return;

    // Если это команда – обрабатываем и не отправляем в Firebase
    if (handleCommand(text)) {
        messageInput.value = '';
        return;
    }

    const tempId = 'temp_' + Date.now();
    addMessageToUI(text, 'sent', getCurrentTime(), tempId, true);
    messageInput.value = '';

    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
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
        
        const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempElement) {
            tempElement.remove();
        }
        
    } catch (error) {
        console.error('❌ Ошибка отправки:', error);
        
        const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempElement) {
            tempElement.classList.add('error');
            tempElement.querySelector('.message-text').textContent = '❌ Ошибка отправки: ' + text;
        }
    }
}

// Отображение сообщений
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

// Добавление сообщения в UI
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

// Прокрутка вниз
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Вспомогательные функции времени
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

// Проверка авторизации при загрузке
function checkAuthOnLoad() {
    try {
        const savedUser = sessionStorage.getItem('wolf_current_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            const account = CONFIG.validAccounts.find(acc => acc.login === currentUser.login);
            if (account) {
                currentUser.isAdmin = CONFIG.adminLogins.includes(currentUser.login);
            }
            // Убедимся, что записи в Firebase существуют и добавлены начальные контакты
            initUserInFirebase()
                .then(() => {
                    showPage('app');
                    loadUserInterface();
                    updateUserStatus(true);
                })
                .catch((error) => {
                    console.error('❌ Ошибка восстановления сессии:', error);
                    sessionStorage.removeItem('wolf_current_user');
                    currentUser = null;
                    showPage('login-page');
                    document.getElementById('error-message').textContent = 'Ошибка подключения к серверу.';
                });
        } else {
            showPage('login-page');
        }
    } catch (e) {
        console.error('Ошибка восстановления сессии:', e);
        sessionStorage.removeItem('wolf_current_user');
        showPage('login-page');
    }
}

// Выход
async function logout() {
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

// Обработчик перезагрузки
window.addEventListener('beforeunload', function() {
    if (currentUser) {
        updateUserStatus(false);
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запуск приложения...');
    window.initApp = initApp;
});
