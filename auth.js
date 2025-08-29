// Этот код обрабатывает отправку формы входа.
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    // Проверяем, что форма существует на странице.
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // Останавливаем стандартную отправку формы.

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // URL вашей Netlify функции для авторизации
            const authUrl = '/.netlify/functions/auth';

            try {
                const response = await fetch(authUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // КЛЮЧЕВАЯ СТРОКА: Правильно формируем тело запроса в формате JSON.
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    // Если авторизация успешна, сохраняем токен и перенаправляем.
                    localStorage.setItem('token', data.token);
                    window.location.href = 'lk.html';
                } else {
                    // Если ошибка, показываем сообщение от сервера.
                    alert(data.message || 'Неверный email или пароль');
                }
            } catch (error) {
                console.error('Ошибка при авторизации:', error);
                alert('Произошла ошибка при попытке входа. Пожалуйста, попробуйте позже.');
            }
        });
    } else {
        console.error('Элемент формы входа не найден.');
    }
});
