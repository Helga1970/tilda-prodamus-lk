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
            
            if (!user || !user.email) {
                alert('Ошибка: Данные пользователя не найдены. Пожалуйста, попробуйте войти снова.');
                window.location.href = '/';
                return;
            }

            try {
                // Перенаправляем сразу на прокси-действие функции
                window.location.href = `/.netlify/functions/get-content?action=proxy&page=chitalnyizal&email=${encodeURIComponent(user.email)}`;

            } catch (e) {
                console.error('Ошибка:', e);
                alert('Произошла ошибка при получении доступа к материалам.');
            }
        };
    </script>
</body>
</html>
