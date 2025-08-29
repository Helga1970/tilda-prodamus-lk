// --- Главная функция-обработчик ---
exports.handler = async (event) => {
    const { action, page } = event.queryStringParameters;
    const tildaPages = {
        'chitalnyizal': '74377421',
        'new-book': '74377422'
    };

    if (!action) {
        return { statusCode: 400, body: 'Неверный запрос. Укажите action.' };
    }

    switch (action) {
        case 'check-access':
            const token = event.headers.authorization?.split(' ')[1];
            if (!token) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Нет токена авторизации' }),
                };
            }

            try {
                // Проверяем токен с помощью твоего секретного ключа
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const email = decoded.email; // Получаем почту из токена

                const hasAccess = await checkSubscription(email);
                if (!hasAccess) {
                    const errorBody = 'Доступ запрещён. Для доступа требуется действующая подписка. Для оплаты подписки перейдите по ссылке: https://pro-culinaria.ru/aboutplatej';
                    return {
                        statusCode: 403,
                        body: errorBody
                    };
                }
                
                // Если токен валиден и подписка активна, отдаем контент с Tilda
                const pageId = tildaPages[page];
                if (!pageId) {
                    return { statusCode: 404, body: 'Страница не найдена.' };
                }

                const tildaResponse = await getTildaContent(pageId);
                return tildaResponse;

            } catch (err) {
                // Если токен невалиден (неверный ключ, просрочен), возвращаем ошибку
                return {
                    statusCode: 401,
                    body: JSON.stringify({ message: 'Неверный токен' }),
                };
            }

        // Случай 2: Проксирование контента.
        // Этот action остается прежним, потому что он уже использует JWT
        case 'proxy':
            // ... (оставь код, как есть)
            break;
            
        default:
            return { statusCode: 400, body: 'Неверный action.' };
    }
};
