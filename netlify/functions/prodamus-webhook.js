// netlify/functions/prodamus-webhook.js

exports.handler = async (event) => {
  // Этот код будет запускаться каждый раз, когда наш URL получает запрос.
  
  // Мы получаем данные, которые Продамус отправит в теле запроса.
  const payload = JSON.parse(event.body);

  // Выводим данные в консоль, чтобы их можно было увидеть в логах Netlify.
  console.log('Received webhook from Prodamus:', payload);

  // Возвращаем успешный ответ Продамусу.
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Webhook received successfully!" })
  };
};
