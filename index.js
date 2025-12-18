require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { TOKEN } = require('./config');
const { CHAT_ID } = require('./config');
const userStreaks = {};

const bot = new TelegramBot(TOKEN, { polling: true });

// Команды
require('./commands/start')(bot);
require('./commands/help')(bot);
require('./commands/test')(bot);
require('./commands/motivate')(bot);

// Опросы и цитаты
require('./polls/pollScheduler')(bot, CHAT_ID);
require('./polls/pollHandler')(bot, userStreaks);

console.log('Бот запущен...');
console.log(new Date());
