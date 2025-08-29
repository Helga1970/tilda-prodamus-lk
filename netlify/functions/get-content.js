const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const checkSubscription = async (email) => {
    const client = new Client({ connectionString: process.env.NEON_DB_URL });
    try {
        await client.connect();
        const res = await client.query('SELECT access_end_date FROM users WHERE email = $1', [email]);

        if (res.rows.length === 0) return false;

        const accessEndDate = new Date(res.rows[0].access_end_date);
        const now = new Date();
        return accessEndDate >= now;
    } catch (err) {
        console.error('Ошибка при проверке подписки:', err);
        return false;
    } finally {
        await client.end();
    }
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const token = event.headers.authorization?.split(' ')[1];
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Нет токена авторизации' }) };
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;

        const hasAccess = await checkSubscription(email);

        if (hasAccess) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'access_granted', message: 'Доступ разрешен.' }),
            };
        } else {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'access_denied', message: 'Доступ запрещён. Требуется действующая подписка.' }),
            };
        }

    } catch (err) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Неверный или просроченный токен' }) };
    }
};
