// Этот код гарантирует, что скрипт выполняется только после загрузки всей страницы.
document.addEventListener('DOMContentLoaded', function() {
    
    // Проверяем, существует ли элемент формы входа, прежде чем пытаться добавить обработчик.
    const loginForm = document.getElementById('loginForm');
    
    // Выводим простое сообщение в консоль, чтобы подтвердить, что скрипт работает.
    console.log('Скрипт запущен. Элемент формы входа:', loginForm);

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // Отменяем стандартную отправку формы.

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const authUrl = '/.netlify/functions/auth';

            console.log('Попытка входа с данными:', { email, password });

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
                    console.log('Вход успешен! Сохраняем токен:', data.token);
                    localStorage.setItem('token', data.token);
                    window.location.href = 'lk.html';
                } else {
                    console.error('Ошибка входа:', data.message);
                    alert(data.message || 'Неверный email или пароль');
                }
            } catch (error) {
                console.error('Ошибка авторизации:', error);
                alert('Произошла ошибка при попытке входа. Пожалуйста, попробуйте позже.');
            }
        });
    } else {
        console.error('Ошибка: Элемент формы входа не найден. Проверьте ID в вашем HTML.');
    }
});
