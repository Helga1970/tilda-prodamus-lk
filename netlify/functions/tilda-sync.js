const { promises: fs } = require('fs');
const path = require('path');
const axios = require('axios');

exports.handler = async (event) => {
    const { pageid, publickey } = event.queryStringParameters;

    // Ключи берутся из переменных окружения
    const tildaPublicKey = process.env.TILDA_PUBLIC_KEY;
    const tildaSecretKey = process.env.TILDA_SECRET_KEY;

    if (!publickey || publickey !== tildaPublicKey) {
        return {
            statusCode: 401,
            body: 'Not authorized'
        };
    }

    if (!pageid) {
        return {
            statusCode: 400,
            body: 'Missing page ID'
        };
    }

    try {
        const apiUrl = `https://api.tildacdn.info/v1/getpagefullexport/?publickey=${tildaPublicKey}&secretkey=${tildaSecretKey}&pageid=${pageid}`;
        const apiResponse = await axios.get(apiUrl);

        if (apiResponse.data.status !== 'FOUND') {
            return {
                statusCode: 500,
                body: 'Failed to get page from Tilda API'
            };
        }

        const pageHtml = apiResponse.data.result.html;
        const pageFileName = 'lk-content.html';
        const filePath = path.join('/tmp', pageFileName);

        await fs.writeFile(filePath, pageHtml);

        console.log(`Successfully updated ${pageFileName}`);

        return {
            statusCode: 200,
            body: 'ok'
        };

    } catch (error) {
        console.error('Tilda webhook error:', error);
        return {
            statusCode: 500,
            body: 'Error processing request'
        };
    }
};
