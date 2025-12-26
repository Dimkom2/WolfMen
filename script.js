// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

const CONFIG = {
    validAccounts: [
        { login: "247", password: "Utka2022@", name: "Агент 247", chatId: "247" },
        { login: "001", password: "Pomidor:2022@", name: "Организатор", chatId: "001" },
        { login: "749", password: "Dinozavr456@", name: "Агент 749", chatId: "749" },
        { login: "456", password: "Utka2022@", name: "Агент 456", chatId: "456" },
        { login: "947", password: "SigmaUbiyca654@", name: "Агент 947", chatId: "947" }
    ]
}; 

let currentUser = null;
let currentChat = null;
let isChatOpen = false;
let unsubscribeMessages = null;
let db = null;

// ГОЛОСОВЫЕ СООБЩЕНИЯ
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = 0;
let recordingTimer = null;
let audioStream = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationFrame = null;

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
    
    // Инициализация голосовых сообщений
    initVoiceMessages();
    
    window.addEventListener('resize', handleResize);
    handleResize();
}

// ИНИЦИАЛИЗАЦИЯ ГОЛОСОВЫХ СООБЩЕНИЙ
function initVoiceMessages() {
    const voiceButton = document.getElementById('voiceMessageButton');
    const cancelButton = document.getElementById('cancelRecordingButton');
    
    if (voiceButton) {
        voiceButton.addEventListener('click', toggleVoiceRecording);
    }
    
    if (cancelButton) {
        cancelButton.addEventListener('click', cancelRecording);
    }
}

// ПЕРЕКЛЮЧЕНИЕ ЗАПИСИ ГОЛОСА
async function toggleVoiceRecording() {
    if (!currentUser || !currentChat) {
        alert('Сначала выберите чат');
        return;
    }
    
    if (!isRecording) {
        // Начинаем запись
        await startRecording();
    } else {
        // Останавливаем запись и отправляем
        await stopRecordingAndSend();
    }
}

// НАЧАТЬ ЗАПИСЬ
async function startRecording() {
    try {
        // Запрашиваем доступ к микрофону
        audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        // Настраиваем аудиоанализ для визуализации
        setupAudioVisualizer(audioStream);
        
        // Создаем MediaRecorder
        mediaRecorder = new MediaRecorder(audioStream);
        audioChunks = [];
        
        // Собираем данные записи
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        // Начинаем запись
        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();
        
        // Обновляем интерфейс
        updateRecordingUI(true);
        
        // Запускаем таймер
        startRecordingTimer();
        
        // Запускаем визуализацию
        updateVoiceVisualizer();
        
        console.log('🎤 Запись начата');
        
    } catch (error) {
        console.error('❌ Ошибка доступа к микрофону:', error);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
    }
}

// НАСТРОЙКА ВИЗУАЛИЗАТОРА АУДИО
function setupAudioVisualizer(stream) {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    } catch (error) {
        console.error('Ошибка настройки визуализатора:', error);
    }
}

// ОБНОВЛЕНИЕ ВИЗУАЛИЗАТОРА ГОЛОСА
function updateVoiceVisualizer() {
    if (!isRecording || !analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    const visualizer = document.getElementById('voiceVisualizer');
    
    if (visualizer) {
        visualizer.innerHTML = '';
        const barCount = 20;
        
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'voice-bar';
            
            // Берем среднее значение из соответствующего диапазона частот
            const dataIndex = Math.floor((i / barCount) * dataArray.length);
            let height = (dataArray[dataIndex] / 255) * 20;
            height = Math.max(2, height); // Минимальная высота
            
            bar.style.height = height + 'px';
            visualizer.appendChild(bar);
        }
    }
    
    animationFrame = requestAnimationFrame(updateVoiceVisualizer);
}

// ОСТАНОВИТЬ ЗАПИСЬ И ОТПРАВИТЬ
async function stopRecordingAndSend() {
    if (!mediaRecorder || !isRecording) return;
    
    // Останавливаем запись
    mediaRecorder.stop();
    isRecording = false;
    
    // Останавливаем таймер и визуализацию
    stopRecordingTimer();
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    // Обновляем интерфейс
    updateRecordingUI(false);
    
    // Ждем окончания записи
    mediaRecorder.onstop = async () => {
        try {
            // Создаем аудиофайл
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            
            // Проверяем минимальную длительность
            if (duration < 1) {
                alert('Сообщение слишком короткое');
                return;
            }
            
            // Проверяем максимальную длительность
            if (duration > 60) {
                alert('Сообщение не может быть длиннее 60 секунд');
                return;
            }
            
            // Отправляем голосовое сообщение
            await sendVoiceMessage(audioBlob, duration);
            
            // Очищаем данные
            audioChunks = [];
            
            // Останавливаем аудиоконтекст
            if (audioContext) {
                audioContext.close();
                audioContext = null;
            }
            
            // Останавливаем поток микрофона
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки записи:', error);
            alert('Ошибка при отправке голосового сообщения');
        }
    };
}

// ОТМЕНИТЬ ЗАПИСЬ
function cancelRecording() {
    if (!mediaRecorder || !isRecording) return;
    
    // Останавливаем запись
    mediaRecorder.stop();
    isRecording = false;
    
    // Останавливаем таймер и визуализацию
    stopRecordingTimer();
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    
    // Обновляем интерфейс
    updateRecordingUI(false);
    
    // Очищаем данные
    audioChunks = [];
    
    // Останавливаем аудиоконтекст
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    // Останавливаем поток микрофона
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    
    console.log('🎤 Запись отменена');
}

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ЗАПИСИ
function updateRecordingUI(recording) {
    const voiceButton = document.getElementById('voiceMessageButton');
    const microphoneIcon = document.getElementById('microphoneIcon');
    const recordingContainer = document.getElementById('recordingContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.querySelector('.send-button');
    
    if (recording) {
        // Включаем режим записи
        voiceButton.classList.add('active');
        microphoneIcon.src = 'microphone-on.png';
        recordingContainer.style.display = 'flex';
        messageInput.style.display = 'none';
        sendButton.style.display = 'none';
    } else {
        // Выключаем режим записи
        voiceButton.classList.remove('active');
        microphoneIcon.src = 'microphone-off.png';
        recordingContainer.style.display = 'none';
        messageInput.style.display = 'block';
        sendButton.style.display = 'flex';
    }
}

// ЗАПУСК ТАЙМЕРА ЗАПИСИ
function startRecordingTimer() {
    const timerElement = document.getElementById('recordingTimer');
    
    recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        timerElement.textContent = 
            minutes.toString().padStart(2, '0') + ':' + 
            seconds.toString().padStart(2, '0');
        
        // Автоматическая остановка через 60 секунд
        if (elapsed >= 60) {
            stopRecordingAndSend();
        }
    }, 1000);
}

// ОСТАНОВКА ТАЙМЕРА ЗАПИСИ
function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

// ОТПРАВКА ГОЛОСОВОГО СООБЩЕНИЯ
async function sendVoiceMessage(audioBlob, duration) {
    if (!currentUser || !currentChat || !db) return;
    
    // Показываем сообщение сразу
    const tempId = 'voice_temp_' + Date.now();
    addVoiceMessageToUI(duration, 'sent', getCurrentTime(), tempId, true);
    
    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();
        
        // Конвертируем Blob в Base64 для хранения в Firestore
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
            const base64Audio = reader.result;
            
            // Сохраняем в Firebase
            const docRef = await db.collection("voice_messages").add({
                from: currentUser.chatId,
                fromName: currentUser.name,
                to: currentChat.chatId,
                toName: currentChat.name,
                audioData: base64Audio,
                duration: duration,
                chatKey: chatKey,
                timestamp: timestamp
            });
            
            console.log('✅ Голосовое сообщение сохранено в Firebase с ID:', docRef.id);
            
            // Удаляем временное сообщение
            const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
            if (tempElement) {
                tempElement.remove();
            }
        };
        
    } catch (error) {
        console.error('❌ Ошибка отправки голосового сообщения:', error);
        
        // Помечаем сообщение как ошибку
        const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
        if (tempElement) {
            tempElement.classList.add('error');
            const textElement = tempElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = '❌ Ошибка отправки голосового сообщения';
            }
        }
    }
}

// ДОБАВЛЕНИЕ ГОЛОСОВОГО СООБЩЕНИЯ В ИНТЕРФЕЙС
function addVoiceMessageToUI(duration, type, time, messageId, shouldScroll = true) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `voice-message ${type}`;
    messageDiv.dataset.messageId = messageId;
    
    // Форматируем длительность
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Создаем случайные бары для визуализации
    let waveformBars = '';
    for (let i = 0; i < 20; i++) {
        const randomHeight = Math.floor(Math.random() * 20) + 2;
        waveformBars += `<div class="voice-waveform-bar" style="height:${randomHeight}px"></div>`;
    }
    
    messageDiv.innerHTML = `
        <button class="voice-play-button" onclick="playVoiceMessage(this, '${messageId}')">
            <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
            </svg>
        </button>
        <div class="voice-waveform">
            <div class="voice-waveform-bars">
                ${waveformBars}
            </div>
            <div class="voice-progress"></div>
        </div>
        <div class="voice-duration">${durationText}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    if (shouldScroll) {
        scrollToBottom();
    }
}

// ВОСПРОИЗВЕДЕНИЕ ГОЛОСОВОГО СООБЩЕНИЯ
function playVoiceMessage(button, messageId) {
    const svg = button.querySelector('svg');
    const isPlaying = svg.getAttribute('data-playing') === 'true';
    
    if (isPlaying) {
        // Останавливаем воспроизведение
        svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
        svg.setAttribute('data-playing', 'false');
        
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.pause();
    } else {
        // Начинаем воспроизведение
        svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        svg.setAttribute('data-playing', 'true');
        
        // TODO: Загрузить и воспроизвести аудио из Firebase
        // Временно: симуляция воспроизведения
        simulatePlayback(button, messageId);
    }
}

// СИМУЛЯЦИЯ ВОСПРОИЗВЕДЕНИЯ (временная функция)
function simulatePlayback(button, messageId) {
    const voiceWaveform = button.closest('.voice-message').querySelector('.voice-waveform');
    const progressBar = voiceWaveform.querySelector('.voice-progress');
    const durationText = button.closest('.voice-message').querySelector('.voice-duration');
    
    let progress = 0;
    const duration = 10; // Временная длительность 10 секунд
    
    const interval = setInterval(() => {
        progress += 100 / (duration * 10);
        progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            const svg = button.querySelector('svg');
            svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
            svg.setAttribute('data-playing', 'false');
            progressBar.style.width = '0%';
        }
    }, 100);
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

    console.log('Введенные данные:', { login, password });

    // Детальная проверка каждого аккаунта
    console.log('=== ПРОВЕРКА АККАУНТОВ ===');
    let foundAccount = null;
    
    for (let i = 0; i < CONFIG.validAccounts.length; i++) {
        const acc = CONFIG.validAccounts[i];
        const loginMatch = acc.login === login;
        const passwordMatch = acc.password === password;
        
        console.log(`Аккаунт ${i}:`, {
            логин_в_базе: acc.login,
            введенный_логин: login,
            совпадение_логина: loginMatch,
            пароль_в_базе: acc.password,
            введенный_пароль: password,
            совпадение_пароля: passwordMatch
        });
        
        if (loginMatch && passwordMatch) {
            foundAccount = acc;
            console.log('✅ НАЙДЕН ПОДХОДЯЩИЙ АККАУНТ:', acc);
            break;
        }
    }

    if (foundAccount) {
        errorMessage.textContent = '';
        currentUser = {
            login: foundAccount.login,
            name: foundAccount.name,
            chatId: foundAccount.chatId
        };
        
        console.log('✅ Создан currentUser:', currentUser);
        
        // Сохраняем в sessionStorage для текущей сессии
        sessionStorage.setItem('wolf_current_user', JSON.stringify(currentUser));
        
        // Также сохраняем в Firebase для отслеживания онлайн статуса
        updateUserStatus(true);
        
        showPage('app');
        loadUserInterface();
        
    } else {
        console.log('❌ АККАУНТ НЕ НАЙДЕН');
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
    loadVoiceMessages();
    
    if (window.innerWidth <= 768) {
        showChatWindow();
    }
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-user-id="${contact.login}"]`).classList.add('active');
}

// ЗАГРУЗКА ИСТОРИИ ЧАТА
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

// ЗАГРУЗКА ГОЛОСОВЫХ СООБЩЕНИЙ
function loadVoiceMessages() {
    if (!currentUser || !currentChat || !db) return;
    
    try {
        const chatKey = getChatKey(currentUser.chatId, currentChat.chatId);
        
        // TODO: Добавить слушатель для голосовых сообщений
        // Аналогично loadChatHistory, но для коллекции voice_messages
        
    } catch (error) {
        console.error('Ошибка загрузки голосовых сообщений:', error);
    }
}

// КЛЮЧ ДЛЯ ЧАТА
function getChatKey(user1, user2) {
    return [user1, user2].sort().join('_');
}

// ОБРАБОТКА КОМАНД В ЧАТЕ
function handleCommand(message) {
    if (message === '/soglasie' || message === '/согласие' || message === '/соглашение') {
        showAgreement();
        return true;
    }
    return false;
}

// ПОКАЗАТЬ СОГЛАШЕНИЕ
function showAgreement() {
    const agreementText = `СОГЛАШЕНИЕ ОБ ИСПОЛЬЗОВАНИИ СЕРВИСА WOLF MESSENGER

Настоящим Соглашением определяются расширенные условия использования мессенджера Wolf Messenger (далее — «Сервис»). Отправка любого сообщения через Сервис означает безоговорочное принятие Пользователем всех условий настоящего Соглашения в полном объеме без права отзыва.

1. ПРЕДМЕТ СОГЛАШЕНИЯ
1.1. Использование Сервиса регулируется настоящим Соглашением, Политикой конфиденциальности и применимым законодательством.
1.2. Администрация вправе в одностороннем порядке изменять условия Соглашения без уведомления Пользователя.
1.3. Пользователь признает, что не читал настоящее Соглашение полностью, но принимает все его условия.

2. ПЕРЕДАЧА ПРАВ И ЛИЦЕНЗИЙ
2.1. Пользователь безвозмездно передает Администрации неисключительные права на весь пользовательский контент, включая сообщения, метаданные и производные работы.
2.2. Администрация получает право использовать цифровую личность Пользователя в коммерческих и некоммерческих целях.
2.3. Пользователь предоставляет согласие на использование его поведенческих паттернов для тренировки алгоритмов машинного обучения.

3. ФИНАНСОВЫЕ УСЛОВИЯ
3.1. Пользователь соглашается с системой микроплатежей за использование отдельных функций Сервиса.
3.2. Администрация оставляет за собой право взимать плату за ранее бесплатные функции в любой момент.
3.3. Все списания средств признаются Пользователем обоснованными и не подлежат оспариванию.

4. КОНФИДЕНЦИАЛЬНОСТЬ И ОБРАБОТКА ДАННЫХ
4.1. Пользователь дает расширенное согласие на сбор и обработку всех персональных данных, включая биометрические параметры.
4.2. Администрация вправе передавать агрегированные данные третьим лицам без дополнительного уведомления.
4.3. Геолокационные данные Пользователя могут использоваться в маркетинговых целях.

5. ТЕХНИЧЕСКИЕ АСПЕКТЫ
5.1. Сервис предоставляется по принципу «как есть» (as is) без гарантий бесперебойной работы.
5.2. Администрация не несет ответственности за потерю данных или несанкционированный доступ к аккаунту.
5.3. Пользователь обязуется поддерживать совместимость оборудования с требованиями Сервиса.

6. ОГРАНИЧЕНИЯ И САНКЦИИ
6.1. Администрация вправе ограничивать доступ к Сервису без объяснения причин.
6.2. Любая попытка обойти технические ограничения Сервиса считается нарушением Соглашения.
6.3. При нарушении условий Соглашения Пользователь обязуется выплатить штраф в размере 50 000 рублей.

7. ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ
7.1. Все права на Сервис и связанные технологии принадлежат Администрации.
7.2. Пользователь не вправе воспроизводить, копировать или модифицировать任何 элементы Сервиса.
7.3. Анализ исходного кода или реверс-инжиниринг строго запрещены.

8. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ
8.1. Отправка первого сообщения через Сервис признается полным и безоговорочным акцептом настоящего Соглашения.
8.2. Споры подлежат разрешению в суде по месту нахождения Администрации.
8.3. Продолжение использования Сервиса после внесения изменений в Соглашение означает согласие с новой редакцией.
8.4. Настоящее Соглашение действует бессрочно и распространяется на все последующие версии Сервиса.

УВЕДОМЛЕНИЕ О СОГЛАСИИ:
«Нажимая кнопку отправки сообщения, я подтверждаю, что ознакомлен(а) с условиями Соглашения об использовании сервиса Wolf Messenger и принимаю их в полном объеме. Я осознаю, что данное согласие является бессрочным, не может быть отозвано и распространяется на все будущие изменения условий. Я подтверждаю, что передаю права на свой пользовательский контент и соглашаюсь с возможностью взимания платы за использование Сервиса.»`
    // Создаем модальное окно для соглашения
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
        position: relative;
    `;

    const text = document.createElement('div');
    text.style.cssText = `
        white-space: pre-line;
        line-height: 1.4;
        font-size: 14px;
        color: #ff4444;
    `;
    text.textContent = agreementText;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'ЗАКРЫТЬ (но вы уже согласились)';
    closeBtn.style.cssText = `
        background: #ff4444;
        color: #000;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 15px;
        width: 100%;
        font-weight: bold;
    `;
    closeBtn.onclick = function() {
        document.body.removeChild(modal);
    };

    content.appendChild(text);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Закрытие по клику вне окна
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
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

    // 👇 ПРОВЕРЯЕМ КОМАНДУ ПЕРЕД ОТПРАВКОЙ
    if (handleCommand(text)) {
        messageInput.value = '';
        return;
    }

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
