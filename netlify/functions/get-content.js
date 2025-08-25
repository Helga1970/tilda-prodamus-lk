const axios = require('axios');
const { Client } = require('pg');

const checkSubscription = async (email) => {
    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });
    try {
        await client.connect();
        const query = 'SELECT access_end_date FROM users WHERE email = $1';
        const result = await client.query(query, [email]);
        if (result.rows.length === 0) {
            return false;
        }
        const endDate = new Date(result.rows[0].access_end_date);
        const now = new Date();
        return endDate > now;
    } catch (error) {
        console.error('Ошибка при проверке подписки:', error);
        return false;
    } finally {
        await client.end();
    }
};

exports.handler = async (event) => {
    const userEmail = event.headers['x-user-email'];

    if (!userEmail) {
        return {
            statusCode: 401,
            body: 'Не авторизован.'
        };
    }

    const hasAccess = await checkSubscription(userEmail);

    if (!hasAccess) {
        return {
            statusCode: 403,
            body: 'Доступ запрещён. Ваша подписка истекла.'
        };
    }

    try {
        const tildaPageUrl = 'https://pro-culinaria.ru/chitalnyizal';
        const response = await axios.get(tildaPageUrl, {
            headers: {
                'Referer': 'https://pro-culinaria.ru/'
            }
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: response.data
        };
    } catch (error) {
        console.error('Ошибка при проксировании контента:', error);
        return {
            statusCode: 500,
            body: 'Ошибка при загрузке контента.'
        };
    }
};
