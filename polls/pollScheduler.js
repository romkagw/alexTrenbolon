module.exports = (bot, CHAT_ID) => {
    const cron = require('node-cron');

    cron.schedule('0 15 * * 1,3,5', () => {
        bot.sendPoll(
            CHAT_ID,
            "Идёте ли вы сегодня в зал? 💪",
            ["Да", "Нет", "Может быть"],
            { is_anonymous: false }
        );
    }, {
        timezone: "Europe/Kiev"
    });
};
