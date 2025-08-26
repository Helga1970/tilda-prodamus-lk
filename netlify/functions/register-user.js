const { Client } = require('pg');
const bcrypt = require('bcryptjs');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Request body is missing' })
        };
    }
    
    // Парсинг данных из тела запроса, включая новое поле name
    const { name, email, password } = JSON.parse(event.body);

    if (!name || !email || !password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Name, e-mail, and password are required' })
        };
    }

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        const userExistsQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const userExistsResult = await client.query(userExistsQuery, [email]);
        if (userExistsResult.rows[0].count > 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: 'Пользователь с таким e-mail уже зарегистрирован' })
            };
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() - 1);

        // Обновлённый запрос для вставки, теперь включает имя
        const insertUserQuery = 'INSERT INTO users (name, email, password, access_end_date) VALUES ($1, $2, $3, $4) RETURNING id';
        const newUserResult = await client.query(insertUserQuery, [name, email, hashedPassword, accessEndDate.toISOString()]);
        
        console.log(`New user registered with ID: ${newUserResult.rows[0].id}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Регистрация прошла успешно!' })
        };

    } catch (error) {
        console.error('Ошибка при регистрации пользователя:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Произошла ошибка сервера при регистрации' })
        };
    } finally {
        await client.end();
    }
};
