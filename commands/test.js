module.exports = (bot) => {
    bot.onText(/\/test/, (msg) => {
        bot.sendMessage(msg.chat.id, 'Это тестовое сообщение, чтобы проверить работу бота.');
        bot.sendPoll(
            msg.chat.id,
            "Идёте ли вы сегодня в зал? 💪", // вопрос
            ["Да", "Нет", "Может быть"],     // варианты
            { is_anonymous: false }           // сделать опрос не анонимным
        );
    });
};
