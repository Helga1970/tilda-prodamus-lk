const { Client } = require('pg');

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

exports.handler = async (event) => {
    const userEmail = event.headers['x-user-email'];
    const page = event.queryStringParameters.page || 'menu';

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

    if (page === 'menu') {
        const menuHtml = `
            <h2>Доступные материалы:</h2>
            <ul>
                <li><a href="#" onclick="loadContent('chitalnyizal'); return false;">Читальный зал</a></li>
                <li><a href="#" onclick="loadContent('new-book'); return false;">Новая книга</a></li>
            </ul>
        `;
        return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: menuHtml };
    }

    const pageUrl = pages[page];

    if (!pageUrl) {
        return { statusCode: 404, body: 'Страница не найдена.' };
    }

    // **Новый подход для iframe:** возвращаем URL, а не HTML
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pageUrl })
    };
};
