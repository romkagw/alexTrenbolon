const TelegramBot = require('node-telegram-bot-api');

// Вставь сюда токен от BotFather
const token = '7987249458:AAHbbfaqBZRDenlQuN9e7BKVMJVPqfv46AI';

// Создаем бота с включенным polling (он постоянно проверяет новые сообщения)
const bot = new TelegramBot(token, { polling: true });

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Я простой бот 😎');
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Напиши /start чтобы начать');
});

// Любое сообщение (ответ "Эхо")
bot.on('message', (msg) => {
    // Игнорируем команды, чтобы не дублировать
    if (!msg.text.startsWith('/')) {
        bot.sendMessage(msg.chat.id, `Ты написал: ${msg.text}`);
    }
});

console.log('Бот запущен...');
