const { Client } = require('pg');
const crypto = require('crypto');
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
    const { action, page, token } = event.queryStringParameters;

    const tildaPages = {
        'chitalnyizal': '74377421', // Замените на реальные ID страниц
        'new-book': '74377422'
    };

    if (!action) {
        return { statusCode: 400, body: 'Неверный запрос. Укажите action.' };
    }

    switch (action) {
        case 'generate':
            const userEmail = event.headers['x-user-email'];

            if (!userEmail) {
                return { statusCode: 401, body: 'Не авторизован.' };
            }

            const hasAccess = await checkSubscription(userEmail);
            if (!hasAccess) {
                return { statusCode: 403, body: 'Доступ запрещён. Ваша подписка истекла.' };
            }

            const tildaPageId = tildaPages[page];
            if (!tildaPageId) {
                return { statusCode: 404, body: 'Страница не найдена.' };
            }

            const client = new Client({ connectionString: process.env.NEON_DB_URL });
            try {
                await client.connect();

                const newToken = crypto.randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                
                const insertQuery = 'INSERT INTO tokens (token, page_id, expires_at) VALUES ($1, $2, $3)';
                await client.query(insertQuery, [newToken, tildaPageId, expiresAt]);

                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: newToken })
                };

            } catch (error) {
                console.error('Ошибка при генерации токена:', error);
                return { statusCode: 500, body: 'Ошибка сервера.' };
            } finally {
                await client.end();
            }

        case 'proxy':
            if (!token) {
                return { statusCode: 400, body: 'Токен не указан.' };
            }
            
            const dbClient = new Client({ connectionString: process.env.NEON_DB_URL });
            try {
                await dbClient.connect();

                const lookupQuery = 'SELECT page_id FROM tokens WHERE token = $1 AND expires_at >= NOW()';
                const result = await dbClient.query(lookupQuery, [token]);

                if (result.rows.length === 0) {
                    return { statusCode: 403, body: 'Недействительный или просроченный токен.' };
                }

                const pageId = result.rows[0].page_id;
                
                const deleteQuery = 'DELETE FROM tokens WHERE token = $1';
                await dbClient.query(deleteQuery, [token]);

                const tildaResponse = await getTildaContent(pageId);
                return tildaResponse;

            } catch (error) {
                console.error('Ошибка при использовании токена:', error);
                return { statusCode: 500, body: 'Ошибка сервера.' };
            } finally {
                await dbClient.end();
            }

        default:
            return { statusCode: 400, body: 'Неверный action.' };
    }
};
