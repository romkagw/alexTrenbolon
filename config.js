require('dotenv').config();

module.exports = {
    TOKEN: process.env.TELEGRAM_TOKEN,
    // Telegram id владельца дневника — бот отвечает только ему
    OWNER_ID: process.env.OWNER_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    // Секрет, который Telegram присылает в заголовке X-Telegram-Bot-Api-Secret-Token
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    REDIS_URL: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    REDIS_TOKEN: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    TIMEZONE: 'Europe/Kiev',
};
