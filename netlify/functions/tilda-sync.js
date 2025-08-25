const axios = require('axios');

exports.handler = async (event) => {
    try {
        // Вебхук от Тильды всегда POST
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        // Данные от Тильды
        const body = JSON.parse(event.body || "{}");
        const pageId = body.pageid;

        if (!pageId) {
            return { statusCode: 400, body: "No pageid provided" };
        }

        const tildaPublicKey = process.env.TILDA_PUBLIC_KEY;
        const tildaSecretKey = process.env.TILDA_SECRET_KEY;

        // Берём страницу целиком
        const apiUrl = `https://api.tildacdn.info/v1/getpagefullexport/?publickey=${tildaPublicKey}&secretkey=${tildaSecretKey}&pageid=${pageId}`;
        const apiResponse = await axios.get(apiUrl);

        if (apiResponse.data.status !== 'FOUND') {
            return { statusCode: 500, body: "Failed to fetch page from Tilda API" };
        }

        const pageData = apiResponse.data.result;
        const pageHtml = pageData.fullhtml || "";

        // Логируем для проверки
        console.log("✅ Вебхук сработал:", {
            pageId: pageId,
            title: pageData.title,
            url: pageData.url
        });

        // Отвечаем Тильде успехом
        return {
            statusCode: 200,
            body: `Page ${pageId} synced successfully`
        };

    } catch (error) {
        console.error("❌ Webhook error:", error);
        return { statusCode: 500, body: "Webhook error" };
    }
};
