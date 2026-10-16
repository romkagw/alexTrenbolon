const { WEBHOOK_SECRET } = require('../config');
const { getBot } = require('../lib/bot');
const { handleUpdate } = require('../lib/handleUpdate');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    if (!WEBHOOK_SECRET || req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
        return res.status(401).end();
    }

    try {
        await handleUpdate(getBot(), req.body);
    } catch (e) {
        console.error('Update error', e);
    }

    // Всегда 200, иначе Telegram будет бесконечно повторять апдейт
    res.status(200).end();
};
