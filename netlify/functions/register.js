const { Client } = require('pg');

exports.handler = async (event, context) => {
    const { email, password, subscription_type } = JSON.parse(event.body);

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        // Проверка, существует ли пользователь с таким email
        const userExists = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({ message: "Пользователь с таким email уже существует." }),
            };
        }

        // Расчет даты окончания доступа
        let accessEndDate = new Date();
        if (subscription_type === '30_days') {
            accessEndDate.setDate(accessEndDate.getDate() + 30);
        } else if (subscription_type === '365_days') {
            accessEndDate.setDate(accessEndDate.getDate() + 365);
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Неверный тип подписки." }),
            };
        }

        // Добавление нового пользователя в базу данных
        const query = 'INSERT INTO users (email, password, subscription_type, access_end_date) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [email, password, subscription_type, accessEndDate.toISOString()];
        const res = await client.query(query, values);

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Пользователь успешно зарегистрирован",
                user: res.rows[0],
            }),
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Ошибка сервера: " + err.message,
            }),
        };
    } finally {
        await client.end();
    }
};
