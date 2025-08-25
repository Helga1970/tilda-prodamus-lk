const { URLSearchParams } = require('url');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Client } = require('pg');

// Функция для обработки регистрации
const handleRegistration = async (client, email, password, subscriptionType) => {
    // Проверка, существует ли пользователь
    const userExists = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
        return {
            statusCode: 409,
            body: JSON.stringify({ message: "Пользователь с таким email уже существует." }),
        };
    }

    // Расчет даты окончания доступа
    let accessEndDate = new Date();
    if (subscriptionType === '30_days') {
        accessEndDate.setDate(accessEndDate.getDate() + 30);
    } else if (subscriptionType === '365_days') {
        accessEndDate.setDate(accessEndDate.getDate() + 365);
    } else {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Неверный тип подписки." }),
        };
    }

    const query = 'INSERT INTO users (email, password, subscription_type, access_end_date) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [email, password, subscriptionType, accessEndDate.toISOString()];
    const res = await client.query(query, values);

    return {
        statusCode: 201,
        body: JSON.stringify({
            message: "Пользователь успешно зарегистрирован",
            user: res.rows[0],
        }),
    };
};

// Функция для обработки вебхука Prodamus
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
    
    // Проверяем, существует ли пользователь
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [customerEmail]);

    if (userResult.rows.length > 0) {
        // Пользователь существует - обновляем данные (продлеваем подписку)
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
        // Пользователь не существует - создаем нового
        const accessEndDate = new Date();
        accessEndDate.setDate(accessEndDate.getDate() + accessDays);
        const password = crypto.randomBytes(4).toString('hex');

        const insertQuery = 'INSERT INTO users (email, password, name, subscription_type, access_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const insertValues = [customerEmail, password, customerName, subscriptionType, accessEndDate.toISOString()];
        await client.query(insertQuery, insertValues);

        // Отправляем письмо с паролем
        const transporter = nodemailer.createTransport({
          host: 'in-v3.mailjet.com',
          port: 587,
          secure: false,
          auth: {
            user: '51db8ea3183fdd19e18f7cb18e52c32d',
            pass: '98289e767513278bd19fc129544da3b6'
          }
        });

        const mailOptions = {
          from: 'pro.culinaria.ru@gmail.com',
          to: customerEmail,
          subject: 'Доступ к Личному кабинету',
          html: `
            <h2>Здравствуйте, ${customerName}!</h2>
            <p>Благодарим за оплату. Ваш доступ к материалам открыт на **${accessDays}** дней.</p>
            <p>Ваши данные для входа в Личный кабинет:</p>
            <ul>
              <li>**Email:** ${customerEmail}</li>
              <li>**Пароль:** ${password}</li>
            </ul>
            <p>Войдите в свой Личный кабинет, чтобы получить доступ к материалам.</p>
            <p>Ссылка на ЛК: https://tilda-prodamus-lk.netlify.app</p>
          `,
        };
        await transporter.sendMail(mailOptions);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Database and email updated successfully." }),
    };
};

exports.handler = async (event, context) => {
    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

        const { email, password } = JSON.parse(event.body);

        // Определяем тип запроса
        if (password) {
            // Это запрос на авторизацию
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
        } else {
            // Это вебхук от Prodamus
            const params = new URLSearchParams(event.body);
            const payload = Object.fromEntries(params.entries());
            return await handleProdamusWebhook(client, payload);
        }
    } catch (err) {
        console.error('Ошибка в обработчике:', err);
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
