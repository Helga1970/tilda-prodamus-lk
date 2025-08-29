// Код для обработки формы входа
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // URL вашей Netlify функции для авторизации
        // Здесь используется правильный файл, который отвечает за авторизацию
        const authUrl = '/.netlify/functions/auth'; 

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

// Код для отправки токена с запросами к защищенным страницам
// Вставьте этот код там, где вы делаете запросы к своему серверу
const protectedUrl = 'https://ваше_имя.netlify.app/.netlify/functions/check-access?action=check-access';

async function checkAccess() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Если токена нет, перенаправляем на страницу входа
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch(protectedUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            alert('Доступ запрещен: ' + data.message);
            window.location.href = 'index.html'; // Снова перенаправляем на вход
        } else {
            // Успех, можно показывать контент
            console.log('Доступ разрешен:', data);
        }
    } catch (error) {
        console.error('Ошибка проверки доступа:', error);
        alert('Произошла ошибка при проверке доступа.');
        window.location.href = 'index.html';
    }
}
