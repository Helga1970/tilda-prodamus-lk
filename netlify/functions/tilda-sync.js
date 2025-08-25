const axios = require('axios');

exports.handler = async (event) => {
    const { publickey, pageid } = event.queryStringParameters;

    const tildaPublicKey = process.env.TILDA_PUBLIC_KEY;
    const tildaSecretKey = process.env.TILDA_SECRET_KEY;

    if (!publickey || publickey !== tildaPublicKey) {
        return {
            statusCode: 401,
            body: 'Not authorized'
        };
    }

    try {
        // Берём pageid из запроса, если есть
        const pageId = pageid || "74377421";

        const apiUrl = `https://api.tildacdn.info/v1/getpagefullexport/?publickey=${tildaPublicKey}&secretkey=${tildaSecretKey}&pageid=${pageId}`;
        const apiResponse = await axios.get(apiUrl);

        if (apiResponse.data.status !== 'FOUND') {
            return {
                statusCode: 500,
                body: 'Failed to get page from Tilda API'
            };
        }

        const pageHtml = apiResponse.data.result.html;

        // Возвращаем HTML прямо в ответе
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            },
            body: pageHtml
        };

    } catch (error) {
        console.error('Tilda webhook error:', error);
        return {
            statusCode: 500,
            body: 'Error processing request'
        };
    }
};
