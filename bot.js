const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const token = process.env.TELEGRAM_TOKEN;

if (!token) {
    console.error("Ошибка: Telegram Bot Token не найден!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Здесь ID чата, куда бот будет слать опрос
// Можно использовать личный ID или группу
const CHAT_ID = process.env.CHAT_ID; // Рекомендую добавить в переменные окружения

if (!CHAT_ID) {
    console.error("Ошибка: CHAT_ID не указан!");
    process.exit(1);
}

// Команды бота
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет долбоебы! Я бот-опросник 😎');
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Я буду спрашивать вас про зал каждый понедельник, среду и пятницу в 14:00');
});

bot.on('message', (msg) => {
    console.log('CHAT ID:', msg.chat.id);
});
// --- Планировщик ---
// Каждую неделю, понедельник, среда, пятница в 14:00
cron.schedule('0 14 * * 1,3,5', () => {
    bot.sendMessage(CHAT_ID, 'Идёте ли вы сегодня в зал? 💪');
});

console.log('Бот запущен...');
