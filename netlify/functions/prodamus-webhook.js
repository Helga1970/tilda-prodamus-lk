// netlify/functions/prodamus-webhook.js
const { URLSearchParams } = require('url');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Bad Request: Empty body." }),
    };
  }
  const params = new URLSearchParams(event.body);
  const payload = Object.fromEntries(params.entries());

  if (payload.payment_status !== 'success') {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Payment was not successful." }),
    };
  }

  const customerEmail = payload.customer_email;
  const customerName = payload.order_num || 'Клиент';

  if (!customerEmail) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing customer email." }),
    };
  }

  let accessDays;
  const paymentSum = parseFloat(payload.sum);

  if (paymentSum === 350.00) {
    accessDays = 30;
  } else if (paymentSum === 3000.00) {
    accessDays = 365;
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Unknown payment amount." }),
    };
  }

  const password = crypto.randomBytes(4).toString('hex');
  
  // -------------------------------------------------------------
  // НАСТРОЙКИ ДЛЯ MAILJET
  // -------------------------------------------------------------
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

  try {
    await transporter.sendMail(mailOptions);
    console.log('Письмо успешно отправлено клиенту.');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully." }),
    };
  } catch (error) {
    console.error('Ошибка при отправке письма:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error sending email." }),
    };
  }
};
