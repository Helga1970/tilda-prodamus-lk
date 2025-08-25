const { Client } = require('pg');
const crypto = require('crypto');

// Временное хранилище токенов (для теста, можно потом заменить на базу)
const tokenStore = {};

const checkSubscription = async (email) => {
    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });
    try {
        await client.connect();
        const query = 'SELECT access_end_date FROM users WHERE email = $1';
        const result = await client.query(query, [email]);
        if (result.rows.length === 0) return false;

        const endDateMs = new Date(result.rows[0].access_end_date).getTime();
        const nowMs = new Date().getTime();

        return endDateMs >= nowMs;
    } catch (error) {
        console.error('Ошибка при проверке подписки:', error);
        return false;
    } finally {
        await client.end();
    }
};

// Генерация случайного токена
const generateToken = (url) => {
    const token = crypto.randomBytes(16).toString('hex');
    // Сохраняем токен на 5 минут
    tokenStore[token] = { url, expires: Date.now() + 5 * 60 * 1000 };
    return token;
};

exports.handler = async (event) => {
    const userEmail = event.headers['x-user-email'];
    const page = event.queryStringParameters.page;

    if (!userEmail) {
        return { statusCode: 401, body: 'Не авторизован.' };
    }

    const hasAccess = await checkSubscription(userEmail);
    if (!hasAccess) {
        return { statusCode: 403, body: 'Доступ запрещён. Ваша подписка истекла.' };
    }

    const pages = {
        'chitalnyizal': 'https://pro-culinaria.ru/chitalnyizal',
        'new-book': 'https://pro-culinaria.ru/new-book'
    };

    const pageUrl = pages[page];
    if (!pageUrl) {
        return { statusCode: 404, body: 'Страница не найдена.' };
    }

    const token = generateToken(pageUrl);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    };
};

// Функция для редиректа (в отдельном redirect.js)
exports.lookupUrlByToken = (token) => {
    const record = tokenStore[token];
    if (!record) return null;
    if (Date.now() > record.expires) {
        delete tokenStore[token];
        return null;
    }
    return record.url;
};
