const { URLSearchParams } = require('url');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Client } = require('pg');

exports.handler = async (event) => {
    if (!event.body) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Bad Request: Empty body." }),
        };
    }

    // Prodamus отправляет данные в формате x-www-form-urlencoded,
    // поэтому мы парсим их с помощью URLSearchParams
    const params = new URLSearchParams(event.body);
    const payload = Object.fromEntries(params.entries());

    console.log('Received payload:', JSON.stringify(payload, null, 2));

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

    const client = new Client({
        connectionString: process.env.NEON_DB_URL,
    });

    try {
        await client.connect();

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
            const password = crypto.randomBytes(4).toString('hex');

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

    } catch (err) {
        console.error('Ошибка в webhook:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error in webhook: " + err.message }),
        };
    } finally {
        await client.end();
    }
};
