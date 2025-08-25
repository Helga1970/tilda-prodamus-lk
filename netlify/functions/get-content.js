const axios = require('axios');
const { Client } = require('pg');

const checkSubscription = async (email) => {
    console.log('--- Начинаем проверку подписки ---');
    console.log('Email для проверки:', email);
    
    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });
    try {
        await client.connect();
        const query = 'SELECT access_end_date FROM users WHERE email = $1';
        const result = await client.query(query, [email]);
        
        if (result.rows.length === 0) {
            console.log('Пользователь не найден в базе.');
            return false;
        }
        
        const dbDateString = result.rows[0].access_end_date;
        console.log('Дата из базы данных (raw):', dbDateString);
        
        const endDateMs = new Date(dbDateString).getTime();
        const nowMs = new Date().getTime();
        
        console.log('Дата окончания (timestamp):', endDateMs);
        console.log('Текущая дата (timestamp):', nowMs);
        
        const hasAccess = endDateMs >= nowMs;
        console.log('Результат сравнения (endDate >= now):', hasAccess);
        
        return hasAccess;
    } catch (error) {
        console.error('Критическая ошибка при проверке подписки:', error);
        return false;
    } finally {
        await client.end();
        console.log('--- Проверка подписки завершена ---');
    }
};

exports.handler = async (event) => {
    const userEmail = event.headers['x-user-email'];
    const page = event.queryStringParameters.page || 'menu';

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
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: menuHtml
        };
    }

    const pageUrl = pages[page];

    if (!pageUrl) {
        return {
            statusCode: 404,
            body: 'Страница не найдена.'
        };
    }

    try {
        const response = await axios.get(pageUrl, {
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
