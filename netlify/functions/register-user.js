const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

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

        // Хэширование пароля перед сохранением
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() - 1);

        const insertUserQuery = 'INSERT INTO users (name, email, password, access_end_date) VALUES ($1, $2, $3, $4) RETURNING id';
        await client.query(insertUserQuery, [name, email, hashedPassword, accessEndDate.toISOString()]);
        
        // Отправка письма пользователю
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Вы можете использовать другой сервис (например, SendGrid, Mailgun)
            auth: {
                user: process.env.EMAIL_USER, // Ваша почта
                pass: process.env.EMAIL_PASS  // Ваш пароль или App Password
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Регистрация на сайте Pro-Culinaria',
            html: `
                <p>Здравствуйте, ${name}!</p>
                <p>Вы успешно зарегистрировались на сайте Pro-Culinaria.</p>
                <p>Ваши данные для входа:</p>
                <ul>
                    <li>**E-mail:** ${email}</li>
                    <li>**Пароль:** ${password}</li>
                </ul>
                <p>Вы можете войти в свой личный кабинет по этой ссылке: <a href="https://pro-culinaria-lk.proculinaria-book.ru">Войти</a></p>
                <p>С уважением,<br>Команда Pro-Culinaria</p>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully!');
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        } finally {
            await client.end();
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
    }
};
