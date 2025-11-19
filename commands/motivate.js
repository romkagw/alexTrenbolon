const quotes = require('../quotes');
const nodeCron = require("node-cron");

module.exports = (bot) => {
    bot.onText(/\/motivate/, (msg) => {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        bot.sendMessage(msg.chat.id, randomQuote);
    });
};

nodeCron.schedule('0 10,17 * * 1,3,4,5', () => {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    // отправляем в чат
    bot.sendMessage(CHAT_ID, randomQuote);
});
