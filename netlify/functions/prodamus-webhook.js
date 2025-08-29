const { Client } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
    const client = new Client({ connectionString: process.env.NEON_DB_URL });
    try {
        await client.connect();

        // Проверяем, что запрос пришел от Prodamus
        if (!event.headers['content-type'] || !event.headers['content-type'].includes('application/x-www-form-urlencoded')) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: "Invalid request. Expected application/x-www-form-urlencoded." }),
            };
        }

        const params = new URLSearchParams(event.body);
        const payload = Object.fromEntries(params.entries());

        // Проверяем статус платежа
        if (payload.payment_status !== 'success') {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: "Payment was not successful." }),
            };
        }
        
        const customerEmail = payload.customer_email;
        const customerName = payload.order_num ? payload.order_num : 'Клиент';
        if (!customerEmail) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ message: "Unknown payment amount." }),
            };
        }

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
            const password = crypto.randomBytes(4).toString('hex');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const accessEndDate = new Date();
            accessEndDate.setDate(accessEndDate.getDate() + accessDays);
            const insertQuery = 'INSERT INTO users (email, password, name, subscription_type, access_end_date) VALUES ($1, $2, $3, $4, $5)';
            const insertValues = [customerEmail, hashedPassword, customerName, subscriptionType, accessEndDate.toISOString()];
            await client.query(insertQuery, insertValues);

            const transporter = nodemailer.createTransport({
                host: process.env.MAILJET_HOST,
                port: process.env.MAILJET_PORT,
                secure: process.env.MAILJET_SECURE,
                auth: {
                    user: process.env.MAILJET_USER,
                    pass: process.env.MAILJET_PASS
                }
            });

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + accessDays);
            const formattedEndDate = endDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

            const mailOptions = {
                from: process.env.MAIL_FROM,
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
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: "Database and email updated successfully." }),
        };
    } catch (err) {
        console.error('Webhook processing error:', err.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: "Server error: " + err.message }),
        };
    } finally {
        await client.end();
    }
};
