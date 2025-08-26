const { Client } = require('pg');
const fetch = require('node-fetch');

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

const getTildaContent = async (pageId) => {
    const publickey = process.env.TILDA_PUBLIC_KEY;
    const secretkey = process.env.TILDA_SECRET_KEY;
    const apiUrl = `https://api.tildacdn.info/v1/getpagefullexport/?publickey=${publickey}&secretkey=${secretkey}&pageid=${pageId}`;
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === 'FOUND') {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: data.result.html
            };
        } else {
            return {
                statusCode: 500,
                body: 'Ошибка: Не удалось получить контент с Tilda.'
            };
        }
    } catch (error) {
        console.error('Ошибка при запросе к Tilda API:', error);
        return {
            statusCode: 500,
            body: 'Произошла ошибка при получении данных.'
        };
    }
};

exports.handler = async (event) => {
    const { action, page, email } = event.queryStringParameters;

    const tildaPages = {
        'chitalnyizal': '74377421', // Замените на реальные ID страниц
        'new-book': '74377422'
    };

    if (!action) {
        return { statusCode: 400, body: 'Неверный запрос. Укажите action.' };
    }

    switch (action) {
        case 'proxy':
            if (!email) {
                return { statusCode: 401, body: 'Не авторизован.' };
            }
            const hasAccess = await checkSubscription(email);
            if (!hasAccess) {
                return { statusCode: 403, body: 'Доступ запрещён. Ваша подписка истекла.' };
            }

            const pageId = tildaPages[page];
            if (!pageId) {
                return { statusCode: 404, body: 'Страница не найдена.' };
            }

            // Получаем и возвращаем контент с Tilda
            const tildaResponse = await getTildaContent(pageId);
            return tildaResponse;

        default:
            return { statusCode: 400, body: 'Неверный action.' };
    }
};
