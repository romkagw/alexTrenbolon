require('dotenv').config();

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
}

// Команды бота
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет долбоебы! Я бот-опросник 😎');
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Я буду спрашивать вас про зал каждый понедельник, среду и пятницу в 14:00');
});

bot.onText(/\/test/, (msg) => {
    bot.sendMessage(msg.chat.id, 'это тестовое сообщение, чтобы проверить работу бота.');
    bot.sendPoll(
        msg.chat.id,
        " Идёте ли вы сегодня в зал? 💪", // вопрос
        ["Да", "Нет", "Может быть"],     // варианты
        {
            is_anonymous: false          // сделать опрос НЕ анонимным (можно включить)
        }
    );
});

// --- Планировщик ---
// Каждую неделю, понедельник, среда, пятница в 14:00
cron.schedule('0 14 * * 1,3,5', () => {
    bot.sendPoll(
        CHAT_ID,
        "Идёте ли вы сегодня в зал? 💪",
        ["Да", "Нет", "Может быть"],
        { is_anonymous: false }
    );
});

console.log('Бот запущен...');
