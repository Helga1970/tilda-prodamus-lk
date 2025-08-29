// Новый код для проверки данных в базе данных
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // ИСПОЛЬЗУЕМ ПРАВИЛЬНЫЙ URL ФУНКЦИИ АВТОРИЗАЦИИ
        const loginUrl = '/.netlify/functions/auth'; // <-- ВОТ ГДЕ ОШИБКА

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Если авторизация успешна, СОХРАНЯЕМ ТОКЕН, который возвращает сервер
                localStorage.setItem('token', data.token); 
                
                // Перенаправляем пользователя на главную страницу личного кабинета
                window.location.href = 'lk.html';
            } else {
                // Если ошибка авторизации, выводим сообщение с сервера
                alert(data.message || 'Неверный email или пароль');
            }
        } catch (error) {
            console.error('Ошибка при авторизации:', error);
            alert('Произошла ошибка при попытке входа. Пожалуйста, попробуйте позже.');
        }
    });
}
