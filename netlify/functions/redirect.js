const { lookupUrlByToken } = require('./get-content'); // импорт функции из get-content.js

exports.handler = async (event) => {
    const token = event.queryStringParameters.token;
    const url = lookupUrlByToken(token);

    if (!url) {
        return { statusCode: 404, body: "Ссылка недействительна или истёк срок действия" };
    }

    return {
        statusCode: 302,
        headers: { Location: url },
        body: ""
    };
};
