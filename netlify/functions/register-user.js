const { Client } = require('pg');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    // 1. Обязательные заголовки CORS для всех ответов
    const headers = {
        'Access-Control-Allow-Origin': 'https://pro-culinaria.ru',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 2. Обработка предварительного OPTIONS-запроса от браузера
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // 204 No Content
            headers: headers,
            body: ''
        };
    }

    // Добавляем заголовки к основному ответу
    try {
        if (event.httpMethod !== 'POST' || !event.body) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: 'Invalid request' })
            };
        }

        const { name, email, password } = JSON.parse(event.body);
        
        if (!name || !email || !password) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: 'Name, e-mail, and password are required' })
            };
        }

        const client = new Client({
            connectionString: process.env.NEON_DB_URL,
        });

        await client.connect();

        const userExistsQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const userExistsResult = await client.query(userExistsQuery, [email]);
        if (userExistsResult.rows[0].count > 0) {
            await client.end();
            return {
                statusCode: 409,
                headers: headers,
                body: JSON.stringify({ error: 'Пользователь с таким e-mail уже зарегистрирован' })
            };
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() - 1);

        const insertUserQuery = 'INSERT INTO users (name, email, password, access_end_date) VALUES ($1, $2, $3, $4) RETURNING id';
        await client.query(insertUserQuery, [name, email, hashedPassword, accessEndDate.toISOString()]);
        
        await client.end();

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: 'Регистрация прошла успешно!' })
        };

    } catch (error) {
        console.error('Ошибка при регистрации пользователя:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ error: 'Произошла ошибка сервера при регистрации' })
        };
    }
};
