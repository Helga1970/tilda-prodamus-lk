const { URLSearchParams } = require('url');
const crypto = require('crypto');
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

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        let payload;
        try {
            if (event.headers['content-type'] && event.headers['content-type'].includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(event.body);
                payload = Object.fromEntries(params.entries());
            } else {
                payload = JSON.parse(event.body);
            }
        } catch (e) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Invalid request body format." }),
            };
        }

        // Логика для входа пользователя (если нет оплаты и есть email/password)
        if (payload.email && payload.password && !payload.payment_status && !payload.name) {
            const { email, password } = payload;
            const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
            const res = await client.query(query, [email, password]);

            if (res.rows.length > 0) {
                return {
                    statusCode: 200,
                    headers: headers,
                    body: JSON.stringify({
                        message: "Успешная авторизация",
                        user: res.rows[0],
                    }),
                };
            } else {
                return {
                    statusCode: 401,
                    headers: headers,
                    body: JSON.stringify({
                        message: "Неверный email или пароль",
                    }),
                };
            }
        }

        // Логика для регистрации/оплаты
        const customerEmail = payload.customer_email || payload.email;
        const customerName = payload.name || (payload.order_num ? payload.order_num : 'Клиент');
        const password = payload.password || crypto.randomBytes(4).toString('hex');
        let accessDays;
        let subscriptionType;

        if (payload.payment_status === 'success') {
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
                    headers: headers,
                    body: JSON.stringify({ message: "Unknown payment amount." }),
                };
            }
        } else if (payload.password) {
            const userExistsResult = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', [customerEmail]);
            if (userExistsResult.rows[0].count > 0) {
                return {
                    statusCode: 409,
                    headers: headers,
                    body: JSON.stringify({ error: 'Пользователь с таким e-mail уже зарегистрирован' })
                };
            }
            // Регистрация через форму
            accessDays = -1; // Доступ по умолчанию "закрыт"
            subscriptionType = 'free';
        } else {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Invalid request data." }),
            };
        }

        if (!customerEmail) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Missing customer email." }),
            };
        }

        const userResult = await client.query('SELECT * FROM users WHERE email = $1', [customerEmail]);

        if (userResult.rows.length > 0 && payload.payment_status === 'success') {
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
        } else if (userResult.rows.length === 0) {
            const accessEndDate = new Date();
            accessEndDate.setDate(accessEndDate.getDate() + accessDays);
            const insertQuery = 'INSERT INTO users (email, password, name, subscription_type, access_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *';
            const insertValues = [customerEmail, password, customerName, subscriptionType, accessEndDate.toISOString()];
            await client.query(insertQuery, insertValues);

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
                from: process.env.EMAIL_SENDER,
                to: customerEmail,
                subject: 'Регистрация на сайте Pro-Culinaria',
                html: `
                    <p>Здравствуйте, ${customerName}!</p>
                    <p>Вы успешно зарегистрировались на сайте Pro-Culinaria.</p>
                    <p>Ваши данные для входа:</p>
                    <ul>
                        <li>**Email:** ${customerEmail}</li>
                        <li>**Пароль:** ${password}</li>
                    </ul>
                    <p>Вы можете войти в свой личный кабинет по этой ссылке: <a href="https://pro-culinaria-lk.proculinaria-book.ru">Войти</a></p>
                    <p>С уважением,<br>Команда Pro-Culinaria</p>
                `,
            };
            await transporter.sendMail(mailOptions);
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: "Success." }),
        };
    } catch (err) {
        console.error('Ошибка в обработчике:', err);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                message: "Ошибка сервера: " + err.message,
            }),
        };
    } finally {
        if (client) {
            await client.end();
        }
    }
};const { URLSearchParams } = require('url');
const crypto = require('crypto');
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

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        let payload;
        try {
            if (event.headers['content-type'] && event.headers['content-type'].includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(event.body);
                payload = Object.fromEntries(params.entries());
            } else {
                payload = JSON.parse(event.body);
            }
        } catch (e) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Invalid request body format." }),
            };
        }

        // Логика для входа пользователя (если нет оплаты и есть email/password)
        if (payload.email && payload.password && !payload.payment_status && !payload.name) {
            const { email, password } = payload;
            const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
            const res = await client.query(query, [email, password]);

            if (res.rows.length > 0) {
                return {
                    statusCode: 200,
                    headers: headers,
                    body: JSON.stringify({
                        message: "Успешная авторизация",
                        user: res.rows[0],
                    }),
                };
            } else {
                return {
                    statusCode: 401,
                    headers: headers,
                    body: JSON.stringify({
                        message: "Неверный email или пароль",
                    }),
                };
            }
        }

        // Логика для регистрации/оплаты
        const customerEmail = payload.customer_email || payload.email;
        const customerName = payload.name || (payload.order_num ? payload.order_num : 'Клиент');
        const password = payload.password || crypto.randomBytes(4).toString('hex');
        let accessDays;
        let subscriptionType;

        if (payload.payment_status === 'success') {
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
                    headers: headers,
                    body: JSON.stringify({ message: "Unknown payment amount." }),
                };
            }
        } else if (payload.password) {
            const userExistsResult = await client.query('SELECT COUNT(*) FROM users WHERE email = $1', [customerEmail]);
            if (userExistsResult.rows[0].count > 0) {
                return {
                    statusCode: 409,
                    headers: headers,
                    body: JSON.stringify({ error: 'Пользователь с таким e-mail уже зарегистрирован' })
                };
            }
            // Регистрация через форму
            accessDays = -1; // Доступ по умолчанию "закрыт"
            subscriptionType = 'free';
        } else {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Invalid request data." }),
            };
        }

        if (!customerEmail) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ message: "Missing customer email." }),
            };
        }

        const userResult = await client.query('SELECT * FROM users WHERE email = $1', [customerEmail]);

        if (userResult.rows.length > 0 && payload.payment_status === 'success') {
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
        } else if (userResult.rows.length === 0) {
            const accessEndDate = new Date();
            accessEndDate.setDate(accessEndDate.getDate() + accessDays);
            const insertQuery = 'INSERT INTO users (email, password, name, subscription_type, access_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *';
            const insertValues = [customerEmail, password, customerName, subscriptionType, accessEndDate.toISOString()];
            await client.query(insertQuery, insertValues);

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
                from: process.env.EMAIL_SENDER,
                to: customerEmail,
                subject: 'Регистрация на сайте Pro-Culinaria',
                html: `
                    <p>Здравствуйте, ${customerName}!</p>
                    <p>Вы успешно зарегистрировались на сайте Pro-Culinaria.</p>
                    <p>Ваши данные для входа:</p>
                    <ul>
                        <li>**Email:** ${customerEmail}</li>
                        <li>**Пароль:** ${password}</li>
                    </ul>
                    <p>Вы можете войти в свой личный кабинет по этой ссылке: <a href="https://pro-culinaria-lk.proculinaria-book.ru">Войти</a></p>
                    <p>С уважением,<br>Команда Pro-Culinaria</p>
                `,
            };
            await transporter.sendMail(mailOptions);
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: "Success." }),
        };
    } catch (err) {
        console.error('Ошибка в обработчике:', err);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                message: "Ошибка сервера: " + err.message,
            }),
        };
    } finally {
        if (client) {
            await client.end();
        }
    }
};
