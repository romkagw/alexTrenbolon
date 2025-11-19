module.exports = (bot) => {
    bot.onText(/\/help/, (msg) => {
        bot.sendMessage(msg.chat.id, 'Я буду спрашивать вас про зал каждый понедельник, среду и пятницу в 14:00');
    });
};
