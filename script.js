const ENCRYPTION_SALT = "WolfPackSecretSalt2026!";
const MAX_MESSAGE_LENGTH = 5000;

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

const tg = window.Telegram?.WebApp;

let currentUser = null;
let currentChat = null;
let isChatOpen = false;
let unsubscribeMessages = null;
let db = null;
let auth = null;

function initApp() {
    console.log('🚀 Инициализация Wolf Messenger...');
    
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase не загружен!');
        showPage('login-page');
        return;
    }
    
    try {
        db = firebase.firestore();
        auth = firebase.auth();
        
        if (auth.setPersistence) {
            auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
                .then(() => console.log('✅ Persistence NONE (сессия не сохраняется)'))
                .catch((err) => console.warn('⚠️ Ошибка установки persistence:', err));
        }
        
        db.enablePersistence()
            .then(() => console.log('✅ Оффлайн поддержка включена'))
            .catch((err) => console.warn('⚠️ Оффлайн режим не доступен:', err));
        console.log('✅ Firestore инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Firestore:', error);
    }
    
    if (tg) {
        tg.expand();
        tg.ready();
    }
    
    initInterface();
    
    // Создаём только администраторов при пустой базе
    ensureAdminUsers().catch(console.error);
    ensureAdminContacts().catch(console.error);
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const saved = sessionStorage.getItem('wolf_current_user');
            if (saved && !currentUser) {
                currentUser = JSON.parse(saved);
                showPage('app');
                await loadUserInterface();
                updateUserStatus(true);
            } else if (!currentUser) {
                const restored = await restoreUserSession(user);
                if (!restored) {
                    await auth.signOut();
                }
            }
        } else {
            if (currentUser) {
                await forceLogout();
            } else {
                showPage('login-page');
            }
        }
    });
    
    if (!auth.currentUser) {
        showPage('login-page');
    }
}

// Создаёт только двух администраторов, если коллекция users пуста
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

// Синхронизирует контакты между администраторами (если их нет)
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
        
        // Взаимное добавление контактов
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

// Вспомогательная функция: добавить контакт, если отсутствует
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

// Команда /addk логин пароль (только для администраторов)
async function handleAddUserCommand(login, password) {
    if (!currentUser || !currentUser.isAdmin) {
        return "❌ Только администраторы могут создавать пользователей.";
    }
    
    login = login.trim();
    if (!login || !password) return "❌ Использование: /addk логин пароль";
    if (login.length < 3) return "❌ Логин должен быть не короче 3 символов";
    if (password.length < 6) return "❌ Пароль должен быть не короче 6 символов";
    
    try {
        // Проверяем, существует ли уже пользователь с таким логином
        const existing = await db.collection('users').where('login', '==', login).get();
        if (!existing.empty) return "❌ Пользователь с таким логином уже существует.";
        
        // Создаём в Firestore
        const chatId = login;
        const salt = generateSalt();
        const passwordHash = hashPasswordWithSalt(password, salt);
        const userData = {
            login: login,
            name: login, // можно позже изменить
            chatId: chatId,
            isAdmin: false,
            salt: salt,
            passwordHash: passwordHash,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(chatId).set(userData);
        
        // Создаём в Authentication
        const email = login + '@wolf.com';
        try {
            await auth.createUserWithEmailAndPassword(email, password);
        } catch (authError) {
            // Если не удалось создать в Auth, откатываем Firestore
            await db.collection('users').doc(chatId).delete();
            if (authError.code === 'auth/email-already-in-use') {
                return "❌ Email уже используется в Authentication. Возможно, пользователь уже был создан ранее.";
            }
            return "❌ Ошибка создания в Authentication: " + authError.message;
        }
        
        // Добавляем контакты: новый пользователь ↔ администраторы
        const admins = await db.collection('users').where('isAdmin', '==', true).get();
        for (let adminDoc of admins.docs) {
            const adminData = adminDoc.data();
            // У администратора добавляем нового
            await addContactIfMissing(adminData.chatId, chatId);
            // У нового добавляем администратора
            await addContactIfMissing(chatId, adminData.chatId);
        }
        
        return `✅ Пользователь ${login} успешно создан. Пароль установлен. Контакты с администраторами добавлены.`;
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        return "❌ Ошибка создания пользователя: " + error.message;
    }
}

// Команда /changepass логин старый_пароль новый_пароль
async function handleChangePassword(login, oldPass, newPass) {
    if (!currentUser) return "❌ Вы не авторизованы.";
    
    // Проверка прав: либо меняем свой пароль, либо мы админ
    const isSelf = (currentUser.login === login);
    if (!isSelf && !currentUser.isAdmin) {
        return "❌ Только администраторы могут менять чужие пароли.";
    }
    
    try {
        const userSnap = await db.collection('users').where('login', '==', login).get();
        if (userSnap.empty) return "❌ Пользователь не найден.";
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        
        // Если меняем не свой пароль, проверяем старый пароль только если это делает сам пользователь
        if (isSelf) {
            const oldHash = hashPasswordWithSalt(oldPass, userData.salt);
            if (userData.passwordHash !== oldHash) {
                return "❌ Неверный старый пароль.";
            }
        }
        
        // Обновляем хэш в Firestore
        const newSalt = generateSalt();
        const newHash = hashPasswordWithSalt(newPass, newSalt);
        await userDoc.ref.update({
            salt: newSalt,
            passwordHash: newHash
        });
        
        // Обновляем пароль в Authentication
        const email = login + '@wolf.com';
        const authUser = auth.currentUser;
        if (authUser && authUser.email === email) {
            await authUser.updatePassword(newPass);
        } else {
            // Если текущий пользователь не тот, чей пароль меняем, нужно войти от его имени? 
            // Но это сложно, поэтому просто обновим через admin SDK? Его нет. 
            // Ограничимся сменой только для текущего пользователя или администратора с доступом к Auth.
            // Для администратора, меняющего чужой пароль, нужен admin SDK, которого у нас нет.
            // Поэтому пока запретим менять чужие пароли (или предложим менять только свой).
            if (!isSelf) {
                return "⚠️ Смена пароля другого пользователя требует дополнительных прав. Пока доступно только для своего аккаунта.";
            }
        }
        
        return `✅ Пароль для ${login} успешно изменён.`;
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        return "❌ Ошибка смены пароля: " + error.message;
    }
}

// Дополняем обработчик команд
function handleCommand(message) {
    if (['/soglasie','/согласие','/соглашение'].includes(message)) {
        showAgreement();
        return true;
    }
    if (message.startsWith('/add ')) {
        if (currentUser?.isAdmin) handleAddCommand(message);
        else alert('Только администраторы могут добавлять контакты');
        return true;
    }
    if (message.startsWith('/addk ')) {
        if (!currentUser?.isAdmin) {
            alert('Только администраторы могут создавать пользователей');
            return true;
        }
        const parts = message.split(' ');
        if (parts.length !== 3) {
            alert('Использование: /addk логин пароль');
            return true;
        }
        const login = parts[1];
        const password = parts[2];
        handleAddUserCommand(login, password).then(msg => alert(msg));
        return true;
    }
    if (message.startsWith('/changepass ')) {
        const parts = message.split(' ');
        if (parts.length !== 4) {
            alert('Использование: /changepass логин старый_пароль новый_пароль');
            return true;
        }
        const login = parts[1];
        const oldPass = parts[2];
        const newPass = parts[3];
        handleChangePassword(login, oldPass, newPass).then(msg => alert(msg));
        return true;
    }
    return false;
}

async function restoreUserSession(user) {
    try {
        const usersRef = db.collection('users');
        let snapshot = await usersRef.where('authUid', '==', user.uid).get();
        
        if (snapshot.empty) {
            const emailLogin = user.email ? user.email.split('@')[0] : null;
            if (emailLogin) {
                snapshot = await usersRef.where('login', '==', emailLogin).get();
            }
        }
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            if (!userData.authUid) {
                await userDoc.ref.update({ authUid: user.uid });
            }
            currentUser = {
                login: userData.login,
                name: userData.name,
                chatId: userData.chatId,
                isAdmin: userData.isAdmin || false,
                uid: user.uid
            };
            sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
            showPage('app');
            await loadUserInterface();
            updateUserStatus(true);
            return true;
        } else {
            console.warn('Пользователь не найден в Firestore, выходим');
            await auth.signOut();
            showPage('login-page');
            return false;
        }
    } catch (error) {
        console.error('Ошибка восстановления сессии:', error);
        await auth.signOut();
        showPage('login-page');
        return false;
    }
}

async function forceLogout() {
    if (currentUser) {
        await updateUserStatus(false);
    }
    currentUser = null;
    currentChat = null;
    isChatOpen = false;
    if (unsubscribeMessages) unsubscribeMessages();
    sessionStorage.removeItem('wolf_current_user');
    showPage('login-page');
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
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
        
        if (!auth) {
            errorMessage.textContent = 'Ошибка аутентификации';
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

        const email = login + '@wolf.com';
        console.log('📧 Email для Auth:', email);
        
        let authUser;
        try {
            console.log('🔑 Пытаемся войти через signInWithEmailAndPassword...');
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            authUser = userCredential.user;
            console.log('✅ Вход выполнен, UID:', authUser.uid);
        } catch (authError) {
            console.warn('⚠️ Ошибка Firebase Auth:', authError.code, authError.message);
            
            if (authError.code === 'auth/operation-not-allowed') {
                errorMessage.textContent = 'Ошибка: вход через Email/Password не включён в Firebase. Включите его в консоли Firebase.';
                return;
            }
            
            if (authError.code === 'auth/user-not-found' || 
                authError.code === 'auth/internal-error' || 
                authError.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                
                console.log('🆕 Пользователь не найден в Auth, создаём...');
                try {
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    authUser = userCredential.user;
                    console.log('✅ Пользователь создан в Auth, UID:', authUser.uid);
                } catch (createError) {
                    console.error('❌ Ошибка создания пользователя:', createError);
                    if (createError.code === 'auth/email-already-in-use') {
                        errorMessage.textContent = 'Пользователь уже существует, но пароль не совпадает.';
                    } else {
                        errorMessage.textContent = 'Ошибка создания аккаунта: ' + createError.message;
                    }
                    return;
                }
            } else {
                errorMessage.textContent = 'Ошибка входа: ' + authError.message;
                return;
            }
        }
        
        if (!userData.authUid || userData.authUid !== authUser.uid) {
            console.log('🔄 Обновляем authUid в Firestore...');
            await userDoc.ref.update({ authUid: authUser.uid });
            console.log('✅ authUid обновлён');
        }
        
        currentUser = {
            login: userData.login,
            name: userData.name,
            chatId: userData.chatId,
            isAdmin: userData.isAdmin || false,
            uid: authUser.uid
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
    
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    await checkUserConsent();
    
    loadContacts();
    initInterface();
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
        el.innerHTML = `
            <div class="contact-avatar ${contact.isOnline ? 'status-online' : 'status-offline'}">${contact.login}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${contact.isOnline ? 'online' : 'offline'}</div>
            </div>
        `;
        el.addEventListener('click', () => openChat(contact));
        contactsList.appendChild(el);
    });
}

function openChat(contact) {
    if (!currentUser) return showPage('login-page');
    currentChat = contact;
    isChatOpen = true;
    document.getElementById('partnerAvatar').textContent = contact.login;
    document.getElementById('partnerName').textContent = contact.name;
    document.getElementById('partnerStatus').textContent = contact.isOnline ? 'online' : 'offline';
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
    if (unsubscribeMessages) unsubscribeMessages();
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
                        <div class="welcome-subtext">Для работы чата нужно создать составной индекс в Firebase. Перейдите по <a href="https://console.firebase.google.com/project/${firebase.app().options.projectId}/database/firestore/indexes" target="_blank">ссылке</a> и создайте индекс для поля chatKey и timestamp.</div>
                    </div>
                `;
            } else {
                messagesContainer.innerHTML = `<div class="welcome-message">Ошибка загрузки: ${error.message}</div>`;
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        messagesContainer.innerHTML = `<div class="welcome-message">Ошибка подключения</div>`;
    }
}

async function sendMessage() {
    if (!currentUser || !currentChat || !db) return showPage('login-page');
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
        alert(`Сообщение слишком длинное (максимум ${MAX_MESSAGE_LENGTH} символов)`);
        return;
    }
    if (handleCommand(text)) { input.value = ''; return; }
    
    let toUid = null;
    try {
        const userDoc = await db.collection('users').doc(currentChat.chatId).get();
        if (userDoc.exists) {
            toUid = userDoc.data().authUid;
        } else {
            console.error('Не найден документ получателя');
            alert('Ошибка: не удалось определить получателя');
            return;
        }
    } catch (error) {
        console.error('Ошибка получения toUid:', error);
        alert('Ошибка при отправке');
        return;
    }
    
    const chatKey = generateChatKey(currentUser.chatId, currentChat.chatId);
    const encrypted = encryptText(text, chatKey);
    const tempId = 'temp_' + Date.now();
    addMessageToUI(text, 'sent', getCurrentTime(), tempId, true);
    input.value = '';
    
    try {
        await db.collection("messages").add({
            from: currentUser.chatId,
            fromName: currentUser.name,
            to: currentChat.chatId,
            toName: currentChat.name,
            fromUid: currentUser.uid,
            toUid: toUid,
            encrypted: encrypted,
            chatKey: chatKey,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        const tempEl = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempEl) tempEl.remove();
    } catch (error) {
        console.error('Ошибка отправки:', error);
        const tempEl = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempEl) {
            tempEl.classList.add('error');
            tempEl.querySelector('.message-text').textContent = '❌ Ошибка: ' + text;
        }
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
    div.innerHTML = `<div class="message-content"><div class="message-text">${text}</div><div class="message-time">${time}</div></div>`;
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
    container.innerHTML = `<div class="welcome-message"><img src="wolf-logo.png" alt="Wolf" class="welcome-logo"><div class="welcome-text">Начните общение с ${name}</div><div class="welcome-subtext">Сообщения защищены шифрованием</div></div>`;
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
}

function initInterface() {
    const input = document.getElementById('messageInput');
    if (input) {
        input.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        input.addEventListener('focus', () => {
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

async function logout() {
    await forceLogout();
}

window.addEventListener('beforeunload', () => {
    if (currentUser) updateUserStatus(false);
});

document.addEventListener('DOMContentLoaded', () => {
    window.initApp = initApp;
});
