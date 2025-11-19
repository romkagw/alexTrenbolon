const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN; // Токен будем хранить в переменной окружения

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Я бот, размещённый на Railway 😎');
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Напиши /start чтобы начать');
});

bot.on('message', (msg) => {
    if (!msg.text.startsWith('/')) {
        bot.sendMessage(msg.chat.id, `Ты написал: ${msg.text}`);
    }
});

console.log('Бот запущен...');
