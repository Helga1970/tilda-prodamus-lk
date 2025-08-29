<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Личный кабинет</title>
</head>
<body>
    <a href="#" onclick="getMaterialsUrl(); return false;">Читальный зал</a>

    <script>
        const getMaterialsUrl = async () => {
            const user = JSON.parse(localStorage.getItem('user'));
            
            if (!user || !user.token) {
                alert('Ошибка: Данные пользователя не найдены. Пожалуйста, попробуйте войти снова.');
                window.location.href = '/';
                return;
            }

            try {
                // Перенаправляем на прокси с токеном в заголовке через fetch
                const response = await fetch('/.netlify/functions/get-content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.token}`
                    },
                    body: JSON.stringify({ action: 'proxy', page: 'chitalnyizal' })
                });

                const result = await response.json();
                if (result.status === 'access_granted') {
                    window.location.href = '/chitalnyizal'; // или фактический URL материалов
                } else {
                    alert(result.message || 'Доступ запрещён');
                }

            } catch (e) {
                console.error('Ошибка:', e);
                alert('Произошла ошибка при получении доступа к материалам.');
            }
        };
    </script>
</body>
</html>
