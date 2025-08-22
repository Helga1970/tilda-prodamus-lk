// netlify/functions/prodamus-webhook.js
const { URLSearchParams } = require('url');

exports.handler = async (event) => {
  // Проверяем, есть ли тело запроса
  if (!event.body) {
    console.log('Получено пустое тело вебхука.');
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Bad Request: Empty body." }),
    };
  }

  // Разбираем данные в формате URL-encoded, которые пришли от Продамуса
  const params = new URLSearchParams(event.body);
  const payload = Object.fromEntries(params.entries());

  // Выводим разобранные данные в консоль
  console.log('Получен вебхук от Продамуса:', payload);

  // Возвращаем Продамусу успешный ответ
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Webhook received and processed successfully!" }),
  };
};
