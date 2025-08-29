// netlify/functions/get-content.js

// ... (оставьте все импорты и вспомогательные функции, как есть) ...
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

// Функция проверки подписки (предполагаем, что она у вас есть и работает)
const checkSubscription = async (email) => {
    // Ваша логика для проверки подписки
    // Подключаемся к БД, ищем пользователя по email и проверяем дату окончания подписки
    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });
    try {
        await client.connect();
        const res = await client.query(
            'SELECT access_end_date FROM users WHERE email = $1',
            [email]
        );

        if (res.rows.length === 0) {
            return false; // Пользователь не найден
        }

        const user = res.rows[0];
        const accessEndDate = new Date(user.access_end_date);
        const now = new Date();

        return accessEndDate >= now; // Возвращаем true, если подписка ещё действует
    } catch (err) {
        console.error('Ошибка при проверке подписки:', err);
        return false;
    } finally {
        await client.end();
    }
};

exports.handler = async (event) => {
    // Проверяем, что запрос является POST-запросом
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    // Получаем токен из заголовка Authorization
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Нет токена авторизации' }),
        };
    }

    try {
        // Проверяем токен с помощью вашего секретного ключа
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email; // Получаем почту из токена

        const hasAccess = await checkSubscription(email);

        if (hasAccess) {
            // Если токен валиден и подписка активна
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'access_granted', message: 'Доступ разрешен.' }),
            };
        } else {
            // Если токен валиден, но подписка истекла
            return {
                statusCode: 200, // Возвращаем 200, чтобы alert на клиенте работал корректно
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'access_denied', message: 'Доступ запрещён. Требуется действующая подписка.' }),
            };
        }

    } catch (err) {
        // Если токен невалиден (неверный ключ, просрочен)
        return {
            statusCode: 401,
            body: JSON.stringify({ message: 'Неверный или просроченный токен' }),
        };
    }
};
