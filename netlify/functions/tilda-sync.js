const { promises: fs } = require('fs');
const path = require('path');
const axios = require('axios');

exports.handler = async (event) => {
    const { publickey } = event.queryStringParameters;

    // Hardcode the specific page ID you want to sync
    const targetPageId = "62118987";

    const tildaPublicKey = process.env.TILDA_PUBLIC_KEY;
    const tildaSecretKey = process.env.TILDA_SECRET_KEY;

    if (!publickey || publickey !== tildaPublicKey) {
        return {
            statusCode: 401,
            body: 'Not authorized'
        };
    }

    try {
        const apiUrl = `https://api.tildacdn.info/v1/getpagefullexport/?publickey=${tildaPublicKey}&secretkey=${tildaSecretKey}&pageid=${targetPageId}`;
        const apiResponse = await axios.get(apiUrl);

        if (apiResponse.data.status !== 'FOUND') {
            return {
                statusCode: 500,
                body: 'Failed to get page from Tilda API'
            };
        }

        const pageHtml = apiResponse.data.result.html;
        const pageFileName = 'lk-content.html';
        const filePath = path.join(process.cwd(), pageFileName);

        await fs.writeFile(filePath, pageHtml);

        console.log(`Successfully updated ${pageFileName} from page ID ${targetPageId}`);

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
