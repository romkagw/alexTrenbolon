process.env.NTBA_FIX_319 = '1';
const TelegramBot = require('node-telegram-bot-api');
const { TOKEN } = require('../config');

let bot;

// На Vercel бот работает без polling: апдейты приходят через webhook
function getBot(options = {}) {
    if (!bot) {
        bot = new TelegramBot(TOKEN, options);
    }
    return bot;
}

module.exports = { getBot };
