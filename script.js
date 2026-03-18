console.log('🚀 Минимальный тест');

// Принудительно показываем страницу входа через 0.1 секунды
setTimeout(() => {
    const loginPage = document.getElementById('login-page');
    const appPage = document.getElementById('app');
    const loadingPage = document.getElementById('loading-page');
    
    if (loginPage) {
        // Скрываем все страницы
        if (loadingPage) loadingPage.classList.remove('active');
        if (appPage) appPage.classList.remove('active');
        
        // Показываем страницу входа
        loginPage.classList.add('active');
        
        // Проверяем, видна ли она
        console.log('login-page classes:', loginPage.className);
        console.log('login-page display:', window.getComputedStyle(loginPage).display);
    } else {
        console.error('❌ Элемент #login-page не найден!');
    }
}, 100);
