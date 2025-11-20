const nodeCron = require("node-cron");
const { CHAT_ID } = require('../config');

module.exports = (bot, quotes) => {

    bot.onText(/\/motivate/, (msg) => {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        bot.sendMessage(msg.chat.id, randomQuote);
    });

    nodeCron.schedule('0 * * * *', () => {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        bot.sendMessage(CHAT_ID, randomQuote);
    });
};
