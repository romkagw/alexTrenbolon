const OpenAI = require("openai");
const { OPENAI_API_KEY } = require('../config');

if (!OPENAI_API_KEY) {
    throw new Error("❌ OPENAI_API_KEY не найден. Проверь .env");
}

module.exports = new OpenAI({ apiKey: OPENAI_API_KEY });
