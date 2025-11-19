module.exports = (bot) => {
    bot.onText(/\/start/, (msg) => {
        bot.sendMessage(msg.chat.id, 'Привет долбоебы! Я бот-опросник 😎');
    });
};
