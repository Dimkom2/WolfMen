// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Аккаунты для входа
const correctAccounts = [
    { login: "247", password: "Utka2022@", name: "Агент 247" },
    { login: "001", password: "Pomidor:2022@", name: "Организатор" },
    { login: "749", password: "Dinozavr456@", name: "Агент 749" }
];

// Глобальные переменные
let currentUser = null;
let currentChat = null;
let chats = {};

// Инициализация приложения
function initApp() {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setBackgroundColor('#000000');
    
    // Инициализируем чаты
    initChats();
    console.log('Telegram Mini App инициализирован');
}

// Инициализация структуры чатов
function initChats() {
    // Для каждого пользователя создаем свои чаты (исключая себя)
    const allUsers = ['247', '001', '749'];
    
    allUsers.forEach(user => {
        chats[user] = {};
        allUsers.forEach(contact => {
            if (user !== contact) {
                chats[user][contact] = {
                    name: getAccountName(contact),
                    messages: getInitialMessages(user, contact)
                };
            }
        });
    });
}

// Получение имени аккаунта
function getAccountName(login) {
    const account = correctAccounts.find(acc => acc.login === login);
    return account ? account.name : login;
}

// Начальные сообщения для каждого чата
function getInitialMessages(user, contact) {
    const initialMessages = {
        '247': {
            '001': [
                { text: 'Организатор, готов к работе', type: 'sent', time: '10:00', sender: '247' },
                { text: '247, жду отчет к 18:00', type: 'received', time: '10:01', sender: '001' }
            ],
            '749': [
                { text: '749, координируем действия', type: 'sent', time: '09:30', sender: '247' },
                { text: 'Понял, на связи', type: 'received', time: '09:31', sender: '749' }
            ]
        },
        '001': {
            '247': [
                { text: '247, готов к работе', type: 'received', time: '10:00', sender: '247' },
                { text: 'Жду отчет к 18:00', type: 'sent', time: '10:01', sender: '001' }
            ],
            '749': [
                { text: '749, задание получено?', type: 'sent', time: '11:00', sender: '001' },
                { text: 'Так точно, выполняю', type: 'received', time: '11:01', sender: '749' }
            ]
        },
        '749': {
            '247': [
                { text: '247, координируем действия', type: 'received', time: '09:30', sender: '247' },
                { text: 'Понял, на связи', type: 'sent', time: '09:31', sender: '749' }
            ],
            '001': [
                { text: '749, задание получено?', type: 'received', time: '11:00', sender: '001' },
                { text: 'Так точно, выполняю', type: 'sent', time: '11:01', sender: '749' }
            ]
        }
    };
    
    return initialMessages[user]?.[contact] || [];
}

// Проверка пароля
function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const isValid = correctAccounts.find(acc => acc.login === login && acc.password === password);

    if (isValid) {
        currentUser = login;
        errorMessage.textContent = '';
        showPage('app');
        initUserInterface();
        // Автоматически выбираем первый доступный чат
        const availableChats = Object.keys(chats[login]);
        if (availableChats.length > 0) {
            switchChat(availableChats[0]);
        }
    } else {
        errorMessage.textContent = 'ОШИБКА: Неверный логин или пароль';
    }
}

// Переключение страниц
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Инициализация интерфейса пользователя
function initUserInterface() {
    // Обновляем информацию о текущем пользователе
    document.getElementById('currentUserAvatar').textContent = currentUser;
    document.getElementById('currentUserName').textContent = getAccountName(currentUser);
    
    // Генерируем список контактов (исключая текущего пользователя)
    generateContactsList();
    
    // Обработчик отправки сообщения
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Генерация списка контактов
function generateContactsList() {
    const contactsList = document.getElementById('contactsList');
    contactsList.innerHTML = '';
    
    const userChats = chats[currentUser];
    Object.keys(userChats).forEach(contactId => {
        const contact = userChats[contactId];
        const lastMessage = contact.messages[contact.messages.length - 1];
        
        const contactElement = document.createElement('div');
        contactElement.className = 'contact';
        contactElement.dataset.chat = contactId;
        contactElement.innerHTML = `
            <div class="contact-avatar">${contactId}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="last-message">${lastMessage ? lastMessage.text : 'Нет сообщений'}</div>
            </div>
        `;
        
        contactElement.addEventListener('click', function() {
            switchChat(contactId);
            if (window.innerWidth <= 768) {
                showChatWindow();
            }
        });
        
        contactsList.appendChild(contactElement);
    });
    
    // Активируем первый контакт
    const firstContact = contactsList.querySelector('.contact');
    if (firstContact) {
        firstContact.classList.add('active');
    }
}

// Переключение чата
function switchChat(chatId) {
    // Убираем активный класс у всех контактов
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    // Добавляем активный класс текущему контакту
    document.querySelector(`[data-chat="${chatId}"]`).classList.add('active');
    
    currentChat = chatId;
    loadChat(chatId);
}

// Загрузка чата
function loadChat(chatId) {
    const chat = chats[currentUser][chatId];
    updateChatHeader(chat.name, chatId);
    
    // Очищаем сообщения
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    // Загружаем сообщения чата
    chat.messages.forEach(msg => {
        const messageType = msg.sender === currentUser ? 'sent' : 'received';
        addMessageToContainer(msg.text, messageType, msg.time);
    });
}

// Отправка сообщения
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (text && currentChat) {
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' + 
                     now.getMinutes().toString().padStart(2, '0');
        
        // Сохраняем сообщение в историю текущего пользователя
        chats[currentUser][currentChat].messages.push({
            text: text,
            type: 'sent',
            time: time,
            sender: currentUser
        });
        
        // Сохраняем сообщение в историю получателя
        if (chats[currentChat] && chats[currentChat][currentUser]) {
            chats[currentChat][currentUser].messages.push({
                text: text,
                type: 'received',
                time: time,
                sender: currentUser
            });
        }
        
        // Добавляем в интерфейс
        addMessageToContainer(text, 'sent', time);
        messageInput.value = '';
        
        // Обновляем последнее сообщение в списке контактов
        updateLastMessage(currentChat, text);
        
        // Имитация ответа через 1-3 секунды
        setTimeout(() => {
            const responses = ['Принято', 'Понял', 'Выполняю', 'На связи'];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            if (chats[currentUser][currentChat]) {
                chats[currentUser][currentChat].messages.push({
                    text: randomResponse,
                    type: 'received',
                    time: getCurrentTime(),
                    sender: currentChat
                });
                
                addMessageToContainer(randomResponse, 'received', getCurrentTime());
                updateLastMessage(currentChat, randomResponse);
            }
        }, 1000 + Math.random() * 2000);
    }
}

// Добавление сообщения в контейнер
function addMessageToContainer(text, type, time) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обновление последнего сообщения в списке контактов
function updateLastMessage(chatId, message) {
    const contactElement = document.querySelector(`[data-chat="${chatId}"]`);
    if (contactElement) {
        const lastMessageElement = contactElement.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message;
        }
    }
}

// Получение текущего времени
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

// Обновление заголовка чата
function updateChatHeader(name, chatId) {
    document.getElementById('partnerName').textContent = name;
    document.getElementById('partnerAvatar').textContent = chatId;
}

// Кнопка "Назад" для мобильных
function goBack() {
    if (window.innerWidth <= 768) {
        hideChatWindow();
    }
}

// Показать окно чата (для мобильных)
function showChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'none';
    document.querySelector('.chat-window').classList.add('active');
}

// Скрыть окно чата (для мобильных)
function hideChatWindow() {
    document.querySelector('.contacts-panel').style.display = 'flex';
    document.querySelector('.chat-window').classList.remove('active');
}

// Обработчик изменения размера окна
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.querySelector('.contacts-panel').style.display = 'flex';
        document.querySelector('.chat-window').classList.add('active');
    }
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    tg.ready();
    initApp();
});
