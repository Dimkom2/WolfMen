// Инициализация Telegram Mini Apps
const tg = window.Telegram.WebApp;

// Аккаунты для входа
const correctAccounts = [
    { login: "247", password: "Utka2022@" },
    { login: "001", password: "Pomidor:2022@" },
    { login: "749", password: "Dinozavr456@" }
];

// Хранилище чатов (пока в памяти, потом заменим на базу)
let chats = {
    '247': {
        name: 'Агент 247',
        messages: []
    },
    'org': {
        name: 'Организатор', 
        messages: []
    }
};

let currentChat = '247';

// Инициализация приложения
function initApp() {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.setBackgroundColor('#000000');
    console.log('Telegram Mini App инициализирован');
}

// Проверка пароля
function checkPassword() {
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const isValid = correctAccounts.find(acc => acc.login === login && acc.password === password);

    if (isValid) {
        errorMessage.textContent = '';
        showPage('app');
        initChatInterface();
        loadChat(currentChat);
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

// Инициализация интерфейса чата
function initChatInterface() {
    // Обработчики для контактов
    const contacts = document.querySelectorAll('.contact');
    contacts.forEach(contact => {
        contact.addEventListener('click', function() {
            const chatId = this.dataset.chat;
            switchChat(chatId);
            
            // На мобильных переключаем на окно чата
            if (window.innerWidth <= 768) {
                showChatWindow();
            }
        });
    });
    
    // Обработчик отправки сообщения
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-button');
    
    function sendMessage() {
        const text = messageInput.value.trim();
        if (text) {
            addMessage(text, 'sent');
            messageInput.value = '';
            
            // Здесь будет отправка на сервер
            // Пока просто имитация ответа через 1 секунду
            setTimeout(() => {
                addMessage('Сообщение доставлено', 'received');
            }, 1000);
        }
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
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
    const chat = chats[chatId];
    updateChatHeader(chat.name, chatId);
    
    // Очищаем сообщения
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    // Загружаем сообщения чата
    chat.messages.forEach(msg => {
        addMessageToContainer(msg.text, msg.type, msg.time);
    });
}

// Добавление сообщения в текущий чат
function addMessage(text, type) {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                 now.getMinutes().toString().padStart(2, '0');
    
    // Сохраняем в историю чата
    chats[currentChat].messages.push({
        text: text,
        type: type,
        time: time
    });
    
    // Добавляем в интерфейс
    addMessageToContainer(text, type, time);
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