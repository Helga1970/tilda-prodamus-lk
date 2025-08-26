const { Client } = require('pg');
const bcrypt = require('bcryptjs');

exports.handler = async (event, context) => {
    // Проверка, что запрос является POST-запросом
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // Проверка, что тело запроса существует
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Request body is missing' })
        };
    }
    
    // Парсинг данных из тела запроса
    const { email, password } = JSON.parse(event.body);

    // Простая валидация данных
    if (!email || !password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Email and password are required' })
        };
    }

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        // 1. Проверка, существует ли пользователь с таким email
        const userExistsQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const userExistsResult = await client.query(userExistsQuery, [email]);
        if (userExistsResult.rows[0].count > 0) {
            return {
                statusCode: 409, // 409 Conflict
                body: JSON.stringify({ error: 'Пользователь с таким email уже зарегистрирован' })
            };
        }

        // 2. Шифрование пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() - 1); // Устанавливаем дату в прошлое

        // 3. Вставка нового пользователя в базу данных Neon
        const insertUserQuery = 'INSERT INTO users (email, password, access_end_date) VALUES ($1, $2, $3) RETURNING id';
        const newUserResult = await client.query(insertUserQuery, [email, hashedPassword, accessEndDate.toISOString()]);
        
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
