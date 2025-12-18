require('dotenv').config();

module.exports = {
    TOKEN: process.env.TELEGRAM_TOKEN,
    CHAT_ID: process.env.CHAT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
};
