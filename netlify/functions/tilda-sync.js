const axios = require('axios');
const { Octokit } = require('@octokit/rest');

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

        // === GitHub commit ===
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN, // создаём Personal Access Token на GitHub
        });

        const owner = "Helga1970";
        const repo = "tilda-prodamus-lk";
        // сохраним в public/{url}/index.html (например: public/chitalnyj-zal/index.html)
        const path = `public/${pageData.alias || pageData.url || 'page-' + pageId}/index.html`;

        // Проверяем, есть ли файл
        let sha;
        try {
            const { data } = await octokit.repos.getContent({ owner, repo, path });
            sha = data.sha;
        } catch (err) {
            sha = undefined; // файла нет — создадим новый
        }

        // Делаем коммит
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: `Update from Tilda page ${pageId} (${pageData.title})`,
            content: Buffer.from(pageHtml).toString("base64"),
            sha,
        });

        return {
            statusCode: 200,
            body: `✅ Page ${pageId} synced and pushed to GitHub (${path})`
        };

    } catch (error) {
        console.error("❌ Webhook error:", error);
        return { statusCode: 500, body: "Webhook error: " + error.message };
    }
};
