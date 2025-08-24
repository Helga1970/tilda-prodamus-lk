// auth.js

// Проверяем, есть ли пользователь в Local Storage
function checkAuth() {
    const user = localStorage.getItem('user');
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (user && isLoginPage) {
        // Если пользователь авторизован, но пытается зайти на страницу входа, перенаправляем его в ЛК
        window.location.href = 'lk.html';
    } else if (!user && !isLoginPage) {
        // Если пользователь не авторизован и пытается попасть в ЛК, перенаправляем на страницу входа
        window.location.href = 'index.html';
    }
}

// Обработчик для страницы входа
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // ВНИМАНИЕ: это временная логика для тестирования.
        // Здесь мы должны будем проверять данные в базе данных
        if (email === 'test@test.com' && password === 'test') {
            localStorage.setItem('user', email);
            window.location.href = 'lk.html';
        } else {
            alert('Неверный email или пароль');
        }
    });
}

// Обработчик для кнопки "Выйти"
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });
}

checkAuth();
