module.exports = (bot, CHAT_ID) => {
    const pollCron = '0 14 * * 1,3,5';
    require('node-cron').schedule(pollCron, () => {
        bot.sendPoll(
            CHAT_ID,
            "Идёте ли вы сегодня в зал? 💪",
            ["Да", "Нет", "Может быть"],
            { is_anonymous: false }
        );
    });
};
