const nodemailer = require('nodemailer');
const { Client } = require('pg');

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

        const { name, email, password } = JSON.parse(event.body);

        if (!name || !email || !password) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: 'Name, e-mail, and password are required' })
            };
        }

        // Проверка, существует ли пользователь
        const userExistsQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
        const userExistsResult = await client.query(userExistsQuery, [email]);
        if (userExistsResult.rows[0].count > 0) {
            return {
                statusCode: 409,
                headers: headers,
                body: JSON.stringify({ error: 'Пользователь с таким e-mail уже зарегистрирован' })
            };
        }

        // Сохранение пароля в открытом виде
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() - 1);

        const insertUserQuery = 'INSERT INTO users (name, email, password, access_end_date) VALUES ($1, $2, $3, $4) RETURNING id';
        await client.query(insertUserQuery, [name, email, password, accessEndDate.toISOString()]);

        // Отправка письма пользователю
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
            subject: 'Регистрация на сайте Pro-Culinaria',
            html: `
                <p>Здравствуйте, ${name}!</p>
                <p>Вы успешно зарегистрировались на сайте Pro-Culinaria.</p>
                <p>Ваши данные для входа:</p>
                <ul>
                    <li>E-mail: ${email}</li>
                    <li>Пароль: ${password}</li>
                </ul>
                <p>Вы можете войти в свой личный кабинет по этой ссылке: <a href="https://pro-culinaria-lk.proculinaria-book.ru">Войти</a></p>
                <p>С уважением,<br>Команда Pro-Culinaria</p>
            `,
        };

        try {
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: 'Регистрация прошла успешно! Проверьте свой e-mail для входа.' })
        };

    } catch (error) {
        console.error('Ошибка при регистрации пользователя:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ error: 'Произошла ошибка сервера при регистрации' })
        };
    } finally {
        if (client) {
            await client.end();
        }
    }
};
