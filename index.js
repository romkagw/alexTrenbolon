// Локальный запуск через polling (npm start).
// Перед этим удалите webhook: https://api.telegram.org/bot<TOKEN>/deleteWebhook
// На Vercel этот файл не используется — там работает api/webhook.js
require('dotenv').config();
const { getBot } = require('./lib/bot');
const { handleUpdate } = require('./lib/handleUpdate');

const bot = getBot({ polling: true });

bot.on('message', (message) => handleUpdate(bot, { message }).catch(console.error));

console.log('Дневник запущен...');
console.log(new Date());
