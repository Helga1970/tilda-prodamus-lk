// Код для обработки формы входа
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Получаем значения email и password из полей ввода
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const authUrl = '/.netlify/functions/auth';

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // ПРАВИЛЬНО ФОРМИРУЕМ ТЕЛО ЗАПРОСА
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Если авторизация успешна, сохраняем токен
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
