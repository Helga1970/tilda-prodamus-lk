// auth.js — клиентский скрипт для входа
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        const authUrl = '/.netlify/functions/auth';

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch (e) {
                console.error("Ошибка парсинга JSON:", e);
                data = {};
            }

            console.log("Ответ сервера:", data);

            if (response.ok && data.token) {
                // Авторизация успешна — сохраняем токен
                localStorage.setItem('token', data.token);
                console.log("Токен сохранён:", localStorage.getItem('token'));
                window.location.href = 'lk.html';
            } else {
                // Ошибка авторизации
                const message = data.message || 'Неверный email или пароль';
                console.error("Ошибка авторизации:", message);
                alert(message);
            }
        } catch (error) {
            console.error('Ошибка при авторизации:', error);
            alert('Произошла ошибка при попытке входа. Пожалуйста, попробуйте позже.');
        }
    });
}
