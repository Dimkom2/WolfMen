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

// Функция шифрования текста с случайным IV
function encryptText(text, keyHex) {
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(text, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return {
        ciphertext: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Hex)
    };
}

// Функция дешифрования текста
function decryptText(encryptedData, keyHex) {
    try {
        const key = CryptoJS.enc.Hex.parse(keyHex);
        const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
        const decrypted = CryptoJS.AES.decrypt(encryptedData.ciphertext, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
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

// Функция получения или создания случайного ключа чата
async function getChatKey(user1, user2) {
    const ids = [user1, user2].sort();
    const docId = ids.join('_');
    const keyRef = db.collection('chat_keys').doc(docId);
    const doc = await keyRef.get();
    if (doc.exists && doc.data().key) {
        return doc.data().key;
    } else {
        const key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
        await keyRef.set({
            key: key,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return key;
    }
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

// Функция очистки устаревших данных (однократно)
async function cleanupOldData() {
    const cleanupFlag = localStorage.getItem('wolf_cleanup_done');
    if (cleanupFlag === 'true') {
        console.log('🧹 Очистка уже выполнена ранее. Пропускаем.');
        return;
    }

    console.log('🧹 Начинаю очистку старых сообщений и ключей...');
    showNotification('Очистка старых данных...', 'info');

    const batchSize = 500;

    async function deleteCollection(collectionName) {
        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) {
            console.log(`Коллекция ${collectionName} пуста.`);
            return;
        }
        let batch = db.batch();
        let count = 0;
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count % batchSize === 0) {
                await batch.commit();
                batch = db.batch();
                console.log(`Удалено ${count} из ${collectionName}...`);
            }
        }
        if (count % batchSize !== 0) {
            await batch.commit();
        }
        console.log(`✅ Коллекция ${collectionName} полностью очищена (${count} документов).`);
    }

    try {
        await deleteCollection('messages');
        await deleteCollection('chat_keys');
        localStorage.setItem('wolf_cleanup_done', 'true');
        showNotification('Очистка завершена!', 'success');
        console.log('🎉 Очистка завершена. Можно пользоваться.');
    } catch (error) {
        console.error('❌ Ошибка при очистке:', error);
        showNotification('Ошибка при очистке данных', 'error');
    }
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
    
    cleanupOldData().catch(console.error);
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
            coins: 0,
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

// Команда: сделать пользователя админом (только 001 и 247)
async function handleAdminCommand(login) {
    if (!currentUser || !['001', '247'].includes(currentUser.login)) {
        return "❌ Недостаточно прав.";
    }
    try {
        const userSnap = await db.collection('users').where('login', '==', login).get();
        if (userSnap.empty) return "❌ Пользователь не найден.";
        const userDoc = userSnap.docs[0];
        await userDoc.ref.update({ isAdmin: true });
        return `✅ Пользователь ${login} теперь администратор.`;
    } catch (error) {
        console.error('Ошибка:', error);
        return "❌ Ошибка при назначении админом.";
    }
}

// Команда: установить произвольную роль (только 001 и 247)
async function handleSetRole(login, role) {
    if (!currentUser || !['001', '247'].includes(currentUser.login)) {
        return "❌ Недостаточно прав.";
    }
    
    role = role.toLowerCase();
    const allowedRoles = ['admin', 'user'];
    if (!allowedRoles.includes(role)) {
        return "❌ Допустимые роли: admin, user";
    }
    
    try {
        const userSnap = await db.collection('users').where('login', '==', login).get();
        if (userSnap.empty) return "❌ Пользователь не найден.";
        const userDoc = userSnap.docs[0];
        await userDoc.ref.update({ isAdmin: role === 'admin' });
        return `✅ Роль пользователя ${login} установлена как ${role}.`;
    } catch (error) {
        console.error('Ошибка:', error);
        return "❌ Ошибка при установке роли.";
    }
}

// Команда: рассылка сообщения всем (только админы)
async function handleBroadcastMessage(text) {
    if (!currentUser || !currentUser.isAdmin) {
        return "❌ Только администраторы могут отправлять рассылку.";
    }
    if (!text) return "❌ Использование: /ms текст сообщения";
    try {
        await db.collection('broadcasts').add({
            from: currentUser.login,
            fromName: currentUser.name,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return "✅ Сообщение отправлено всем сотрудникам.";
    } catch (error) {
        console.error('Ошибка:', error);
        return "❌ Ошибка при отправке рассылки.";
    }
}

// Команда: начислить коины (только 001 и 247)
async function handleAddCoins(login, amount) {
    if (!currentUser || !['001', '247'].includes(currentUser.login)) {
        return "❌ Недостаточно прав.";
    }
    const coins = parseInt(amount);
    if (isNaN(coins) || coins <= 0) return "❌ Укажите положительное количество коинов.";
    try {
        const userSnap = await db.collection('users').where('login', '==', login).get();
        if (userSnap.empty) return "❌ Пользователь не найден.";
        const userDoc = userSnap.docs[0];
        const currentCoins = userDoc.data().coins || 0;
        await userDoc.ref.update({ coins: currentCoins + coins });
        return `✅ Начислено ${coins} WC пользователю ${login}. Новый баланс: ${currentCoins + coins}.`;
    } catch (error) {
        console.error('Ошибка:', error);
        return "❌ Ошибка при начислении коинов.";
    }
}

// Команда: перевести коины (все, минимум 10000)
async function handlePayCoins(targetLogin, amount) {
    if (!currentUser) return "❌ Вы не авторизованы.";
    const coins = parseInt(amount);
    if (isNaN(coins) || coins <= 0) return "❌ Укажите положительное количество коинов.";
    if (coins < 10000) return "❌ Минимальный перевод 10 000 WC.";
    if (targetLogin === currentUser.login) return "❌ Нельзя перевести самому себе.";
    
    try {
        const targetSnap = await db.collection('users').where('login', '==', targetLogin).get();
        if (targetSnap.empty) return "❌ Получатель не найден.";
        
        const senderRef = db.collection('users').doc(currentUser.chatId);
        const targetRef = targetSnap.docs[0].ref;
        
        await db.runTransaction(async (transaction) => {
            const senderDoc = await transaction.get(senderRef);
            const targetDoc = await transaction.get(targetRef);
            
            const senderCoins = senderDoc.data()?.coins || 0;
            const targetCoins = targetDoc.data()?.coins || 0;
            
            if (senderCoins < coins) {
                throw new Error('❌ Недостаточно коинов для перевода.');
            }
            
            transaction.update(senderRef, { coins: senderCoins - coins });
            transaction.update(targetRef, { coins: targetCoins + coins });
        });
        
        return `✅ Переведено ${coins} WC пользователю ${targetLogin}.`;
    } catch (error) {
        console.error('Ошибка перевода:', error);
        if (error.message.includes('Недостаточно')) return error.message;
        return "❌ Ошибка при переводе коинов.";
    }
}

// Команда: создать пользователя (уже с coins)
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
            coins: 0,
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

// Смена пароля
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
            isAdmin: userData.isAdmin || false,
            coins: userData.coins || 0
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
    
    // Обновляем нижнюю часть с профилем
    document.getElementById('currentUserAvatar').textContent = currentUser.login;
    document.getElementById('currentUserAvatar').className = 'profile-avatar ' + getColorClass(currentUser.login);
    document.getElementById('currentUserName').textContent = currentUser.name;
    document.getElementById('currentUserStatus').textContent = 'online';
    
    await checkUserConsent();
    
    loadContacts();
    loadProfileData();
    checkBroadcasts();
}

// Загрузка данных профиля
async function loadProfileData() {
    if (!currentUser) return;
    
    document.getElementById('profileAvatar').textContent = currentUser.login;
    document.getElementById('profileAvatar').className = 'profile-avatar-large ' + getColorClass(currentUser.login);
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileLogin').textContent = '@' + currentUser.login;
    document.getElementById('profileRole').textContent = currentUser.isAdmin ? 'Администратор' : 'Пользователь';
    
    // Загружаем актуальный баланс и детали
    try {
        const userDoc = await db.collection('users').doc(currentUser.chatId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const coins = userData.coins || 0;
            document.getElementById('profileCoins').textContent = coins.toLocaleString();
            currentUser.coins = coins;
            
            // Заполняем детали
            const detailsContainer = document.getElementById('profileDetails');
            if (detailsContainer) {
                const formatDate = (timestamp) => {
                    if (timestamp && timestamp.toDate) {
                        return timestamp.toDate().toLocaleDateString('ru-RU');
                    }
                    return 'Неизвестно';
                };
                
                const createdAt = userData.createdAt ? formatDate(userData.createdAt) : 'Неизвестно';
                const lastSeen = userData.lastSeen ? formatDate(userData.lastSeen) : 'Никогда';
                
                // Получаем количество контактов
                const contactDoc = await db.collection('contacts').doc(currentUser.chatId).get();
                const contactsCount = contactDoc.exists ? (contactDoc.data().contacts?.length || 0) : 0;
                
                detailsContainer.innerHTML = `
                    <div class="detail-item">
                        <span class="detail-label">Логин</span>
                        <span class="detail-value">${escapeHtml(currentUser.login)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">ID чата</span>
                        <span class="detail-value">${escapeHtml(currentUser.chatId)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Дата регистрации</span>
                        <span class="detail-value">${escapeHtml(createdAt)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Последний визит</span>
                        <span class="detail-value">${escapeHtml(lastSeen)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Контактов</span>
                        <span class="detail-value">${contactsCount}</span>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки баланса и деталей:', error);
        document.getElementById('profileCoins').textContent = currentUser.coins || 0;
    }
}

// Проверка новых рассылок
async function checkBroadcasts() {
    try {
        const lastSeen = localStorage.getItem('wolf_last_broadcast_time') || '1970-01-01';
        const snapshot = await db.collection('broadcasts')
            .where('timestamp', '>', new Date(lastSeen))
            .orderBy('timestamp', 'asc')
            .get();
        
        if (!snapshot.empty) {
            const latest = snapshot.docs[snapshot.docs.length - 1].data();
            showNotification(`📢 ${latest.fromName}: ${latest.text}`, 'info');
            localStorage.setItem('wolf_last_broadcast_time', new Date().toISOString());
        }
    } catch (error) {
        console.error('Ошибка проверки рассылок:', error);
    }
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

async function loadChatHistory() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer || !currentUser || !currentChat) return;
    messagesContainer.innerHTML = '<div class="loading">Загрузка сообщений...</div>';
    
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
    
    try {
        const chatKey = await getChatKey(currentUser.chatId, currentChat.chatId);
        
        const chatId = 'chat_' + [currentUser.chatId, currentChat.chatId].sort().join('_');
        const q = db.collection("messages").where('chatKey', '==', chatId);
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
        const chatKey = await getChatKey(currentUser.chatId, currentChat.chatId);
        const encryptedData = encryptText(text, chatKey);
        
        tempId = 'temp_' + Date.now();
        addMessageToUI(text, 'sent', getCurrentTime(), tempId, true);
        input.value = '';
        
        const chatId = 'chat_' + [currentUser.chatId, currentChat.chatId].sort().join('_');
        await db.collection("messages").add({
            from: currentUser.chatId,
            fromName: currentUser.name,
            to: currentChat.chatId,
            toName: currentChat.name,
            fromUid: currentUser.chatId,
            toUid: toUid,
            encrypted: encryptedData.ciphertext,
            iv: encryptedData.iv,
            chatKey: chatId,
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
        let decrypted;
        if (msg.iv) {
            decrypted = decryptText({ ciphertext: msg.encrypted, iv: msg.iv }, chatKey);
        } else {
            // Обратная совместимость (не используется после очистки)
            decrypted = decryptText({ ciphertext: msg.encrypted, iv: '12345678901234567890123456789012' }, chatKey);
        }
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
    // Сбрасываем прокрутку, чтобы не оставалась позиция от предыдущего экрана
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
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

function switchTab(tab) {
    const messagesSection = document.getElementById('messages-section');
    const profileSection = document.getElementById('profile-section');
    const navButtons = document.querySelectorAll('.nav-btn');
    
    if (tab === 'messages') {
        messagesSection.classList.add('active');
        profileSection.classList.remove('active');
    } else {
        profileSection.classList.add('active');
        messagesSection.classList.remove('active');
    }
    
    navButtons.forEach(btn => {
        if (btn.dataset.tab === tab) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    if (tab === 'profile') {
        loadProfileData();
    }
}

function showChangePasswordModal() {
    if (!currentUser) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-title">Смена пароля</div>
            <input type="password" id="oldPass" class="modal-input" placeholder="Старый пароль">
            <input type="password" id="newPass" class="modal-input" placeholder="Новый пароль">
            <input type="password" id="confirmPass" class="modal-input" placeholder="Повторите новый пароль">
            <button class="modal-btn" onclick="submitPasswordChange()">Сменить</button>
            <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitPasswordChange() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;
    
    if (newPass !== confirmPass) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    if (!newPass || newPass.length < 6) {
        showNotification('Новый пароль должен быть не короче 6 символов', 'error');
        return;
    }
    
    const result = await handleChangePassword(currentUser.login, oldPass, newPass);
    showNotification(result, result.startsWith('✅') ? 'success' : 'error');
    document.querySelector('.modal-overlay')?.remove();
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
    const trimmed = message.trim();
    
    if (['/soglasie','/согласие','/соглашение'].includes(trimmed.toLowerCase())) {
        showAgreement();
        return true;
    }
    
    if (trimmed.startsWith('/admin')) {
        const args = parseCommandArgs(trimmed);
        if (args.length !== 2) {
            showNotification('Использование: /admin логин', 'warning');
            return true;
        }
        handleAdminCommand(args[1]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/setrole')) {
        const args = parseCommandArgs(trimmed);
        if (args.length !== 3) {
            showNotification('Использование: /setrole логин роль (admin или user)', 'warning');
            return true;
        }
        handleSetRole(args[1], args[2]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/ms')) {
        const args = parseCommandArgs(trimmed);
        if (args.length < 2) {
            showNotification('Использование: /ms текст сообщения', 'warning');
            return true;
        }
        const text = args.slice(1).join(' ');
        handleBroadcastMessage(text).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/addc')) {
        const args = parseCommandArgs(trimmed);
        if (args.length !== 3) {
            showNotification('Использование: /addc логин кол-во', 'warning');
            return true;
        }
        handleAddCoins(args[1], args[2]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/pay')) {
        const args = parseCommandArgs(trimmed);
        if (args.length !== 3) {
            showNotification('Использование: /pay логин кол-во', 'warning');
            return true;
        }
        handlePayCoins(args[1], args[2]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/addk')) {
        if (!currentUser?.isAdmin) {
            showNotification('Только администраторы могут создавать пользователей', 'error');
            return true;
        }
        const args = parseCommandArgs(trimmed);
        if (args.length !== 3) {
            showNotification('Использование: /addk логин пароль', 'warning');
            return true;
        }
        handleAddUserCommand(args[1], args[2]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/changepass')) {
        const args = parseCommandArgs(trimmed);
        if (args.length !== 4) {
            showNotification('Использование: /changepass логин старый_пароль новый_пароль', 'warning');
            return true;
        }
        handleChangePassword(args[1], args[2], args[3]).then(msg => showNotification(msg, msg.startsWith('✅') ? 'success' : 'error'));
        return true;
    }
    
    if (trimmed.startsWith('/add')) {
        if (!currentUser?.isAdmin) {
            showNotification('Только администраторы могут добавлять контакты', 'error');
            return true;
        }
        handleAddCommand(trimmed);
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
    // Убираем фокус с полей
    if (document.activeElement) document.activeElement.blur();
    // Прокрутка вверх
    window.scrollTo(0, 0);
}

window.addEventListener('beforeunload', () => {
    if (currentUser) updateUserStatus(false).catch(console.error);
});

document.addEventListener('DOMContentLoaded', () => {
    window.initApp = initApp;
});
