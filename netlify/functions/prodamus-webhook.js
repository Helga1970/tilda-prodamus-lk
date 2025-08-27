const { URLSearchParams } = require('url');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Client } = require('pg');

const handleProdamusWebhook = async (client, payload) => {
    if (payload.payment_status !== 'success') {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Payment was not successful." }),
        };
    }
    const customerEmail = payload.customer_email;
    const customerName = payload.order_num ? payload.order_num : 'Клиент';
    if (!customerEmail) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing customer email." }),
        };
    }
    let accessDays;
    let subscriptionType;
    const paymentSum = parseFloat(payload.sum);
    if (paymentSum === 350.00) {
        accessDays = 30;
        subscriptionType = '30_days';
    } else if (paymentSum === 3000.00) {
        accessDays = 365;
        subscriptionType = '365_days';
    } else {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Unknown payment amount." }),
        };
    }
    const password = crypto.randomBytes(4).toString('hex');
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [customerEmail]);
    if (userResult.rows.length > 0) {
        const existingUser = userResult.rows[0];
        const currentEndDate = new Date(existingUser.access_end_date);
        let newEndDate;
        if (currentEndDate > new Date()) {
            newEndDate = new Date(currentEndDate.setDate(currentEndDate.getDate() + accessDays));
        } else {
            newEndDate = new Date();
            newEndDate.setDate(newEndDate.getDate() + accessDays);
        }
        const updateQuery = 'UPDATE users SET subscription_type = $1, access_end_date = $2 WHERE email = $3';
        const updateValues = [subscriptionType, newEndDate.toISOString(), customerEmail];
        await client.query(updateQuery, updateValues);
    } else {
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() + accessDays);
        const insertQuery = 'INSERT INTO users (email, password, name, subscription_type, access_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const insertValues = [customerEmail, password, customerName, subscriptionType, accessEndDate.toISOString()];
        await client.query(insertQuery, insertValues);
        const transporter = nodemailer.createTransport({
            host: 'in-v3.mailjet.com',
            port: 587,
            secure: false,
            auth: {
                user: '51db8ea3183fdd19e18f7cb18e52c32d',
                pass: '98289e767513278bd19fc129544da3b6'
            }
        });

        // Форматируем дату окончания доступа
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + accessDays);
        const formattedEndDate = endDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const mailOptions = {
            from: 'mail@proculinaria.ru',
            to: customerEmail,
            subject: 'Доступ к Личному кабинету',
            html: `
            <h2>Здравствуйте, ${customerName}!</h2>
            <p>Благодарим за оплату. Ваш доступ к материалам открыт на ${accessDays} дней, до ${formattedEndDate} включительно.</p>
            <p>Ваши данные для входа в Личный кабинет:</p>
            <ul>
                <li>Email: ${customerEmail}</li>
                <li>Пароль: ${password}</li>
            </ul>
            <p>Войдите в свой Личный кабинет, чтобы получить доступ к материалам.</p>
            <p>Ссылка на ЛК: https://pro-culinaria-lk.proculinaria-book.ru</p>
            `,
        };
        await transporter.sendMail(mailOptions);
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Database and email updated successfully." }),
    };
};

exports.handler = async (event) => {
    console.log('Incoming request event:', JSON.stringify(event, null, 2));

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });
    try {
        await client.connect();
        let requestBody;
        if (event.headers['content-type'] && event.headers['content-type'].includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams(event.body);
            requestBody = Object.fromEntries(params.entries());
            if (requestBody.payment_status) {
                return await handleProdamusWebhook(client, requestBody);
            }
        }
        try {
            requestBody = JSON.parse(event.body);
        } catch (e) {
            const params = new URLSearchParams(event.body);
            requestBody = Object.fromEntries(params.entries());
        }

        const { email, password } = requestBody;

        if (!email || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Отсутствуют email или пароль." }),
            };
        }

        const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
        const values = [email, password];
        const res = await client.query(query, values);
        if (res.rows.length > 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: "Успешная авторизация",
                    user: res.rows[0],
                }),
            };
        } else {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    message: "Неверный email или пароль",
                }),
            };
        }
    } catch (err) {
        console.error('Ошибка при авторизации:', err.message);
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
