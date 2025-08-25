// Новый код для проверки данных в базе данных
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // URL вашей Netlify функции для авторизации
        const loginUrl = '/.netlify/functions/prodamus-webhook'; 

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
                // Если авторизация успешна, сохраняем данные пользователя (например, email)
                localStorage.setItem('user', JSON.stringify(data.user));
                // Можно сохранить токен, если ваш бэкенд его возвращает, для дальнейших запросов
                // localStorage.setItem('token', data.token); 
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
