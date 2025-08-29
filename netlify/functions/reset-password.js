const nodemailer = require('nodemailer');
const { Client } = require('pg');
const crypto = require('crypto');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://pro-culinaria.ru',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST' || !event.body) {
        return {
            statusCode: 400,
            headers: headers,
            body: JSON.stringify({ error: 'Invalid request' })
        };
    }

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        let payload;
        try {
            payload = JSON.parse(event.body);
        } catch (e) {
            const params = new URLSearchParams(event.body);
            payload = Object.fromEntries(params.entries());
        }

        const { email } = payload;

        if (!email) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: 'E-mail is required' })
            };
        }

        const userQuery = 'SELECT * FROM users WHERE email = $1';
        const userResult = await client.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            return {
                statusCode: 404,
                headers: headers,
                body: JSON.stringify({ error: 'Пользователь с таким e-mail не найден.' })
            };
        }

        const newPassword = crypto.randomBytes(8).toString('hex');

        const updatePasswordQuery = 'UPDATE users SET password = $1 WHERE email = $2';
        await client.query(updatePasswordQuery, [newPassword, email]);

        const transporter = nodemailer.createTransport({
            host: 'in-v3.mailjet.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAILJET_API_KEY,
                pass: process.env.MAILJET_SECRET_KEY
            }
        });

        const mailOptions = {
            from: 'pro-culinaria@proculinaria.ru',
            to: email,
            subject: 'Восстановление пароля',
            html: `
                <p>Здравствуйте!</p>
                <p>Ваш логин: ${email}</p>
                <p>Ваш новый пароль для входа в Личный кабинет: ${newPassword}</p>
                <p>Вы можете использовать этот пароль, чтобы войти в свой личный кабинет по этой ссылке: <a href="https://pro-culinaria-lk.proculinaria-book.ru">Войти</a></p>
                <p>С уважением,<br>Команда Pro-Culinaria</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: 'Новый пароль отправлен на вашу почту.' })
        };

    } catch (error) {
        console.error('Ошибка при восстановлении пароля:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ error: 'Произошла ошибка сервера при восстановлении пароля.' })
        };
    } finally {
        if (client) {
            await client.end();
        }
    }
};
