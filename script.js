const ENCRYPTION_SALT = "WolfPackSecretSalt2026!";
const MAX_MESSAGE_LENGTH = 5000;

// Функция экранирования HTML (защита от XSS)
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function encryptText(text, key) {
    const secretKey = CryptoJS.enc.Utf8.parse(key.padEnd(32, '0').slice(0, 32));
    const iv = CryptoJS.enc.Utf8.parse('1234567890123456');
    const encrypted = CryptoJS.AES.encrypt(text, secretKey, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    return encrypted.toString();
}

function decryptText(encryptedText, key) {
    try {
        const secretKey = CryptoJS.enc.Utf8.parse(key.padEnd(32, '0').slice(0, 32));
        const iv = CryptoJS.enc.Utf8.parse('1234567890123456');
        const decrypted = CryptoJS.AES.decrypt(encryptedText, secretKey, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error('Ошибка расшифровки:', e);
        return '[Ошибка расшифровки]';
    }
}

function hashPasswordWithSalt(password, salt) {
    return CryptoJS.SHA256(password + salt).toString();
}

function generateSalt() {
    return CryptoJS.lib.WordArray.random(16).toString();
}

function generateChatKey(userId1, userId2) {
    const sortedIds = [userId1, userId2].sort().join('_');
    return CryptoJS.SHA256(sortedIds + ENCRYPTION_SALT).toString();
}

// Функция для разбора команд с поддержкой кавычек
function parseCommandArgs(input) {
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const args = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
        args.push(match[1] ?? match[2] ?? match[3]);
    }
    return args;
}

// Функция показа тостов
function showNotification(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 3000);
}

// Функция определения цвета аватара на основе логина
function getColorClass(login) {
    let hash = 0;
    if (typeof login === 'string') {
        for (let i = 0; i < login.length; i++) {
            hash = (hash * 31 + login.charCodeAt(i)) & 0xffffffff;
        }
    }
    return 'color-' + (hash % 6);
}

const tg = window.Telegram?.WebApp;

let currentUser = null;
let currentChat = null;
let isChatOpen = false;
let unsubscribeMessages = null;
let db = null;

function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase не загружен!');
        showPage('login-page');
        return;
    }
    
    try {
        db = firebase.firestore();
        console.log('✅ Firestore инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firestore:', error);
    }
    
    if (tg) {
        tg.expand();
        tg.ready();
    }
    
    initInterface();
    
    ensureAdminUsers().catch(console.error);
    ensureAdminContacts().catch(console.error);
    
    const saved = sessionStorage.getItem('wolf_current_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        showPage('app');
        loadUserInterface().catch(console.error);
        updateUserStatus(true).catch(console.error);
    } else {
        showPage('login-page');
    }
}

async function ensureAdminUsers() {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    if (!snapshot.empty) {
        console.log('👥 Пользователи уже существуют');
        return;
    }

    console.log('🆕 Создаём администраторов 247 и 001...');
    const adminList = [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247", isAdmin: true },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001", isAdmin: true }
    ];

    for (const user of adminList) {
        const salt = generateSalt();
        const passwordHash = hashPasswordWithSalt(user.password, salt);
        await usersRef.doc(user.chatId).set({
            login: user.login,
            name: user.name,
            chatId: user.chatId,
            isAdmin: user.isAdmin,
            salt: salt,
            passwordHash: passwordHash,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Создан администратор ${user.login}`);
    }
}

async function ensureAdminContacts() {
    if (!db) return;
    try {
        const adminLogins = ["247", "001"];
        const usersRef = db.collection('users');
        const admins = [];
        
        for (let login of adminLogins) {
            const snap = await usersRef.where('login', '==', login).get();
            if (!snap.empty) admins.push(snap.docs[0].data());
        }
        
        if (admins.length < 2) {
            console.warn('⚠️ Не удалось найти обоих администраторов для синхронизации');
            return;
        }
        
        const admin1 = admins[0];
        const admin2 = admins[1];
        
        await addContactIfMissing(admin1.chatId, admin2.chatId);
        await addContactIfMissing(admin2.chatId, admin1.chatId);
        
        console.log('✅ Контакты администраторов синхронизированы');
        
        if (currentUser && (currentUser.chatId === admin1.chatId || currentUser.chatId === admin2.chatId)) {
            await loadContacts();
        }
    } catch (error) {
        console.error('Ошибка синхронизации контактов:', error);
    }
}

async function addContactIfMissing(userId, contactId) {
    const ref = db.collection('contacts').doc(userId);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({ userId: userId, contacts: [contactId] });
        return true;
    } else {
        const contacts = doc.data().contacts || [];
        if (!contacts.includes(contactId)) {
            contacts.push(contactId);
            await ref.update({ contacts });
            return true;
        }
    }
    return false;
}

async function handleAddUserCommand(login, password) {
    if (!currentUser || !currentUser.isAdmin) {
        return "❌ Только администраторы могут создавать пользователей.";
    }
    
    login = login.trim();
    if (!login || !password) return "❌ Использование: /addk логин пароль";
    if (login.length < 3) return "❌ Логин должен быть не короче 3 символов";
    if (password.length < 6) return "❌ Пароль должен быть не короче 6 символов";
    
    try {
        const existing = await db.collection('users').where('login', '==', login).get();
        if (!existing.empty) return "❌ Пользователь с таким логином уже существует.";
        
        const chatId = login;
        const salt = generateSalt();
        const passwordHash = hashPasswordWithSalt(password, salt);
        const userData = {
            login: login,
            name: login,
            chatId: chatId,
            isAdmin: false,
            salt: salt,
            passwordHash: passwordHash,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(chatId).set(userData);
        
        // Добавляем контакты с администраторами
        const admins = await db.collection('users').where('isAdmin', '==', true).get();
        for (let adminDoc of admins.docs) {
            const adminData = adminDoc.data();
            await addContactIfMissing(adminData.chatId, chatId);
            await addContactIfMissing(chatId, adminData.chatId);
        }
        
        return `✅ Пользователь ${login} успешно создан. Пароль установлен. Контакты с администраторами добавлены.`;
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        return "❌ Ошибка создания пользователя: " + error.message;
    }
}

async function handleChangePassword(login, oldPass, newPass) {
    if (!currentUser) return "❌ Вы не авторизованы.";
    
    const isSelf = (currentUser.login === login);
    if (!isSelf && !currentUser.isAdmin) {
        return "❌ Только администраторы могут менять чужие пароли.";
    }
    
    try {
        const userSnap = await db.collection('users').where('login', '==', login).get();
        if (userSnap.empty) return "❌ Пользователь не найден.";
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        
        if (isSelf) {
            const oldHash = hashPasswordWithSalt(oldPass, userData.salt);
            if (userData.passwordHash !== oldHash) {
                return "❌ Неверный старый пароль.";
            }
        }
        
        const newSalt = generateSalt();
        const newHash = hashPasswordWithSalt(newPass, newSalt);
        await userDoc.ref.update({
            salt: newSalt,
            passwordHash: newHash
        });
        
        return `✅ Пароль для ${login} успешно изменён.`;
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        return "❌ Ошибка смены пароля: " + error.message;
    }
}

async function checkPassword() {
    const login = document.getElementById('login').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    if (!login || !password) {
        errorMessage.textContent = 'Введите логин и пароль';
        return;
    }

    try {
        console.log(`🔐 Попытка входа: логин=${login}`);
        
        if (!db) {
            errorMessage.textContent = 'Ошибка подключения к базе данных';
            return;
        }

        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('login', '==', login).get();
        
        if (snapshot.empty) {
            console.warn('❌ Пользователь не найден в Firestore');
            errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
            document.getElementById('password').value = '';
            return;
        }
        
        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        console.log('👤 Найден пользователь в Firestore:', userData.login, userData.name);

        const hash = hashPasswordWithSalt(password, userData.salt || '');
        if (userData.passwordHash !== hash) {
            console.warn('❌ Неверный пароль (хэш не совпадает)');
            errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
            document.getElementById('password').value = '';
            return;
        }
        console.log('✅ Пароль совпадает с хэшем');

        currentUser = {
            login: userData.login,
            name: userData.name,
            chatId: userData.chatId,
            isAdmin: userData.isAdmin || false
        };
        
        sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        console.log('💾 Текущий пользователь сохранён в sessionStorage');
        
        await initUserContacts();
        await updateUserStatus(true);
        
        showPage('app');
        await loadUserInterface();
        console.log('🎉 Вход успешно завершён');
        
    } catch (error) {
        console.error('❌ Непредвиденная ошибка:', error);
        errorMessage.textContent = 'Ошибка подключения к серверу';
    }
}

async function initUserContacts() {
    if (!db || !currentUser) return;
    const contactRef = db.collection('contacts').doc(currentUser.chatId);
    const contactDoc = await contactRef.get();
    if (!contactDoc.exists) {
        await contactRef.set({
            userId: currentUser.chatId,
            contacts: [],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

async function updateUserStatus(isOnline) {
    if (!db || !currentUser) return;
    try {
        await db.collection('users').doc(currentUser.chatId).set({
            isOnline: isOnline,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
    }
}

async function loadUserInterface() {
    if (!currentUser) {
        showPage('login-page');
        return;
    }
    
    const avatar = document.getElementById('currentUserAvatar');
    avatar.textContent = currentUser.login;
    avatar.className = 'profile-avatar ' + getColorClass(currentUser.login);
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    await checkUserConsent();
    
    loadContacts();
}

function showConsentModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20000;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #000;
            border: 2px solid #ff4444;
            border-radius: 10px;
            padding: 20px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            color: #fff;
            font-family: 'Inter', sans-serif;
        `;

        const agreementText = `СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ

Настоящим Соглашением регулируются условия использования мессенджера Wolf Messenger. Используя Сервис, Пользователь подтверждает согласие с нижеследующими условиями.

1. КОНФИДЕНЦИАЛЬНАЯ ИНФОРМАЦИЯ
1.1. Вся информация, размещенная в Сервисе, включая факт существования организации, логины, имена, переписку, является конфиденциальной.
1.2. Пользователь обязуется не разглашать конфиденциальную информацию третьим лицам.

2. ОТВЕТСТВЕННОСТЬ
2.1. За нарушение обязательств по неразглашению Пользователь несет ответственность по ст. 183 УК РФ.
2.2. Администрация вправе требовать возмещения убытков.

3. ВОЗРАСТ
3.1. Используя Сервис, Пользователь подтверждает, что ему исполнилось 18 лет.

Нажимая «ПРИНИМАЮ», вы подтверждаете согласие с условиями.`;

        const text = document.createElement('div');
        text.style.cssText = `
            white-space: pre-line;
            line-height: 1.4;
            font-size: 14px;
            color: #ff4444;
            margin-bottom: 20px;
        `;
        text.textContent = agreementText;

        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'ПРИНИМАЮ';
        acceptBtn.style.cssText = `
            background: #ff4444;
            color: #000;
            border: none;
            padding: 15px 20px;
            border-radius: 5px;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
            font-size: 16px;
        `;
        acceptBtn.onclick = function() {
            document.body.removeChild(modal);
            resolve(true);
        };

        content.appendChild(text);
        content.appendChild(acceptBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}

async function checkUserConsent() {
    const consentGiven = sessionStorage.getItem('wolf_consent_' + currentUser.chatId);
    if (consentGiven === 'true') return true;
    await showConsentModal();
    sessionStorage.setItem('wolf_consent_' + currentUser.chatId, 'true');
    return true;
}

async function loadContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!currentUser || !contactsList) return;
    contactsList.innerHTML = '<div class="loading">Загрузка контактов...</div>';
    try {
        const contactDoc = await db.collection('contacts').doc(currentUser.chatId).get();
        if (!contactDoc.exists || !contactDoc.data().contacts.length) {
            contactsList.innerHTML = '<div class="loading">У вас пока нет контактов</div>';
            return;
        }
        const contactIds = contactDoc.data().contacts;
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
            }
        }
        displayContacts(contactsData);
    } catch (error) {
        console.error('Ошибка загрузки контактов:', error);
        contactsList.innerHTML = '<div class="loading">Ошибка загрузки контактов</div>';
    }
}

function displayContacts(contacts) {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '';
    contacts.forEach(contact => {
        const el = document.createElement('div');
        el.className = 'contact';
        el.dataset.userId = contact.login;
        
        const avatarClass = getColorClass(contact.login);
        const statusClass = contact.isOnline ? 'status-online' : 'status-offline';
        const statusText = contact.isOnline ? 'online' : 'offline';
        
        el.innerHTML = `
            <div class="contact-avatar ${avatarClass} ${statusClass}">${escapeHtml(contact.login)}</div>
            <div class="contact-info">
                <div class="contact-name">${escapeHtml(contact.name)}</div>
                <div class="last-message ${statusText}">${statusText}</div>
            </div>
        `;
        el.addEventListener('click', () => openChat(contact));
        contactsList.appendChild(el);
    });
}

function openChat(contact) {
    if (!currentUser) return showPage('login-page');
    
    if (currentChat && currentChat.chatId === contact.chatId && isChatOpen) {
        return;
    }
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    currentChat = contact;
    isChatOpen = true;
    const avatar = document.getElementById('partnerAvatar');
    avatar.textContent = contact.login;
    avatar.className = 'partner-avatar ' + getColorClass(contact.login);
    document.getElementById('partnerName').textContent = contact.name;
    const statusEl = document.getElementById('partnerStatus');
    statusEl.textContent = contact.isOnline ? 'online' : 'offline';
    statusEl.className = 'partner-status ' + (contact.isOnline ? 'online' : 'offline');
    document.getElementById('messageInput').disabled = false;
    document.querySelector('.send-button').disabled = false;
    loadChatHistory();
    if (window.innerWidth <= 768) showChatWindow();
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`)?.classList.add('active');
}

function loadChatHistory() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer || !currentUser || !currentChat) return;
    messagesContainer.innerHTML = '<div class="loading">Загрузка сообщений...</div>';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    try {
        const chatKey = generateChatKey(currentUser.chatId, currentChat.chatId);
        const q = db.collection("messages").where('chatKey', '==', chatKey);
        unsubscribeMessages = q.onSnapshot((snapshot) => {
            const msgs = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            msgs.sort((a,b) => (a.timestamp?.toDate()||0) - (b.timestamp?.toDate()||0));
            if (msgs.length === 0) showWelcomeMessage();
            else displayMessages(msgs, chatKey);
        }, (error) => {
            console.error('Ошибка загрузки:', error);
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-text">Требуется создать индекс</div>
                        <div class="welcome-subtext">Для работы чата нужно создать составной индекс в Firebase. Перейдите по <a href="https://console.firebase.google.com/project/${escapeHtml(firebase.app().options.projectId)}/database/firestore/indexes" target="_blank">ссылке</a> и создайте индекс для поля chatKey и timestamp.</div>
                    </div>
                `;
            } else {
                messagesContainer.innerHTML = `<div class="welcome-message">Ошибка загрузки: ${escapeHtml(error.message)}</div>`;
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        messagesContainer.innerHTML = `<div class="welcome-message">Ошибка подключения</div>`;
    }
}

let isSending = false;

async function sendMessage() {
    if (isSending) {
        console.warn('⚠️ Отправка уже выполняется, пропускаем');
        return;
    }
    if (!currentUser || !currentChat || !db) return showPage('login-page');
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
        showNotification(`Сообщение слишком длинное (максимум ${MAX_MESSAGE_LENGTH} символов)`, 'warning');
        return;
    }
    if (handleCommand(text)) { input.value = ''; return; }
    
    let toUid = null;
    try {
        const userDoc = await db.collection('users').doc(currentChat.chatId).get();
        if (userDoc.exists) {
            toUid = userDoc.data().chatId;
        } else {
            console.error('Не найден документ получателя');
            showNotification('Ошибка: не удалось определить получателя', 'error');
            return;
        }
    } catch (error) {
        console.error('Ошибка получения toUid:', error);
        showNotification('Ошибка при отправке', 'error');
        return;
    }
    
    let tempId = null;
    isSending = true;
    try {
        const chatKey = generateChatKey(currentUser.chatId, currentChat.chatId);
        const encrypted = encryptText(text, chatKey);
        tempId = 'temp_' + Date.now();
        addMessageToUI(text, 'sent', getCurrentTime(), tempId, true);
        input.value = '';
        
        await db.collection("messages").add({
            from: currentUser.chatId,
            fromName: currentUser.name,
            to: currentChat.chatId,
            toName: currentChat.name,
            fromUid: currentUser.chatId,
            toUid: toUid,
            encrypted: encrypted,
            chatKey: chatKey,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        const tempEl = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempEl) tempEl.remove();
    } catch (error) {
        console.error('Ошибка отправки:', error);
        if (tempId) {
            const tempEl = document.querySelector(`[data-message-id="${tempId}"]`);
            if (tempEl) {
                tempEl.classList.add('error');
                tempEl.querySelector('.message-text').textContent = '❌ Ошибка: ' + text;
            }
        }
        showNotification('Не удалось отправить сообщение', 'error');
    } finally {
        isSending = false;
    }
}

function displayMessages(messages, chatKey) {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    if (!messages.length) { showWelcomeMessage(); return; }
    messages.forEach(msg => {
        const type = msg.from === currentUser.chatId ? 'sent' : 'received';
        const time = msg.timestamp ? formatFirebaseTime(msg.timestamp) : getCurrentTime();
        const decrypted = decryptText(msg.encrypted, chatKey);
        addMessageToUI(decrypted, type, time, msg.id, false);
    });
    scrollToBottom();
}

function addMessageToUI(text, type, time, id, scroll = true) {
    const container = document.getElementById('messagesContainer');
    const welcome = container.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.dataset.messageId = id;
    div.innerHTML = `<div class="message-content"><div class="message-text">${escapeHtml(text)}</div><div class="message-time">${time}</div></div>`;
    container.appendChild(div);
    if (scroll) scrollToBottom();
}

function scrollToBottom() {
    const c = document.getElementById('messagesContainer');
    if (c) c.scrollTop = c.scrollHeight;
}

function getCurrentTime() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function formatFirebaseTime(ts) {
    if (ts?.toDate) {
        const d = ts.toDate();
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }
    return getCurrentTime();
}

function showWelcomeMessage() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    const name = currentChat ? currentChat.name : 'контактом';
    container.innerHTML = `<div class="welcome-message"><img src="wolf-logo.png" alt="Wolf" class="welcome-logo"><div class="welcome-text">Начните общение с ${escapeHtml(name)}</div><div class="welcome-subtext">Сообщения защищены шифрованием</div></div>`;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
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
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
}

function initInterface() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.removeEventListener('keypress', handleEnter);
        input.addEventListener('keypress', handleEnter);
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 768 && currentChat) {
                isChatOpen = true;
                showChatWindow();
                if (!unsubscribeMessages) {
                    loadChatHistory();
                }
            }
        });
    }
    window.addEventListener('resize', handleResize);
    handleResize();
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleResize() {
    if (window.innerWidth > 768) {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.contacts-panel').style.width = '35%';
        document.querySelector('.chat-window').style.display = 'flex';
        document.querySelector('.chat-window').style.width = '65%';
        document.querySelector('.header-back').style.display = 'none';
    } else {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.header-back').style.display = 'block';
        const chat = document.querySelector('.chat-window');
        if (isChatOpen && currentChat) {
            chat.style.display = 'flex';
            document.querySelector('.contacts-panel').style.display = 'none';
        } else {
            chat.style.display = 'none';
            document.querySelector('.contacts-panel').style.display = 'flex';
        }
    }
}

function handleCommand(message) {
    if (['/soglasie','/согласие','/соглашение'].includes(message.trim().toLowerCase())) {
        showAgreement();
        return true;
    }
    if (message.startsWith('/addk')) {
        if (!currentUser?.isAdmin) {
            showNotification('Только администраторы могут создавать пользователей', 'error');
            return true;
        }
        const args = parseCommandArgs(message);
        if (args.length !== 3) {
            showNotification('Использование: /addk логин пароль', 'warning');
            return true;
        }
        const login = args[1];
        const password = args[2];
        handleAddUserCommand(login, password).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    if (message.startsWith('/changepass')) {
        const args = parseCommandArgs(message);
        if (args.length !== 4) {
            showNotification('Использование: /changepass логин старый_пароль новый_пароль', 'warning');
            return true;
        }
        const login = args[1];
        const oldPass = args[2];
        const newPass = args[3];
        handleChangePassword(login, oldPass, newPass).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    if (message.startsWith('/add')) {
        if (!currentUser?.isAdmin) {
            showNotification('Только администраторы могут добавлять контакты', 'error');
            return true;
        }
        handleAddCommand(message);
        return true;
    }
    return false;
}

async function handleAddCommand(message) {
    const args = parseCommandArgs(message);
    if (args.length !== 3) {
        showNotification('Использование: /add логин1 логин2', 'warning');
        return;
    }
    const login1 = args[1];
    const login2 = args[2];
    if (login1 === login2) {
        showNotification('Нельзя добавить себя к себе', 'error');
        return;
    }
    
    const user1Snap = await db.collection('users').where('login','==',login1).get();
    const user2Snap = await db.collection('users').where('login','==',login2).get();
    if (user1Snap.empty || user2Snap.empty) {
        showNotification('Один из логинов не существует', 'error');
        return;
    }
    
    const acc1 = user1Snap.docs[0].data();
    const acc2 = user2Snap.docs[0].data();
    
    try {
        const added1 = await addContact(acc1.chatId, acc2.chatId);
        const added2 = await addContact(acc2.chatId, acc1.chatId);
        if (currentUser.chatId === acc1.chatId || currentUser.chatId === acc2.chatId) loadContacts();
        if (added1 || added2) {
            showNotification(`Контакты ${login1} и ${login2} теперь видят друг друга`, 'success');
        } else {
            showNotification('Эти контакты уже были добавлены', 'info');
        }
    } catch (e) {
        showNotification('Ошибка при добавлении контактов', 'error');
    }
}

async function addContact(userId, contactId) {
    const ref = db.collection('contacts').doc(userId);
    let added = false;
    await db.runTransaction(async tx => {
        const doc = await tx.get(ref);
        if (!doc.exists) {
            tx.set(ref, { userId, contacts: [contactId], updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            added = true;
        } else {
            const contacts = doc.data().contacts || [];
            if (!contacts.includes(contactId)) {
                contacts.push(contactId);
                tx.update(ref, { contacts, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                added = true;
            }
        }
    });
    return added;
}

function showAgreement() {
    const agreementText = `СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ

Настоящим Соглашением регулируются условия использования мессенджера Wolf Messenger. Используя Сервис, Пользователь подтверждает согласие с нижеследующими условиями.

1. КОНФИДЕНЦИАЛЬНАЯ ИНФОРМАЦИЯ
1.1. Вся информация, размещенная в Сервисе, включая факт существования организации, логины, имена, переписку, является конфиденциальной.
1.2. Пользователь обязуется не разглашать конфиденциальную информацию третьим лицам.

2. ОТВЕТСТВЕННОСТЬ
2.1. За нарушение обязательств по неразглашению Пользователь несет ответственность по ст. 183 УК РФ.
2.2. Администрация вправе требовать возмещения убытков.

3. ВОЗРАСТ
3.1. Используя Сервис, Пользователь подтверждает, что ему исполнилось 18 лет.

Нажимая «ЗАКРЫТЬ», вы подтверждаете, что ознакомлены.`;

    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #000;
        border: 2px solid #ff4444;
        border-radius: 10px;
        padding: 20px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        color: #fff;
        font-family: 'Inter', sans-serif;
    `;

    const text = document.createElement('div');
    text.style.cssText = `
        white-space: pre-line;
        line-height: 1.4;
        font-size: 14px;
        color: #ff4444;
        margin-bottom: 20px;
    `;
    text.textContent = agreementText;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'ЗАКРЫТЬ';
    closeBtn.style.cssText = `
        background: #ff4444;
        color: #000;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        width: 100%;
        font-weight: bold;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    content.appendChild(text);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

async function logout() {
    if (currentUser) {
        await updateUserStatus(false).catch(console.error);
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

window.addEventListener('beforeunload', () => {
    if (currentUser) updateUserStatus(false).catch(console.error);
});

document.addEventListener('DOMContentLoaded', () => {
    window.initApp = initApp;
});
