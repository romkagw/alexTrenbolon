const insults = require('../insults');

module.exports = (bot, userStreaks) => {
    bot.on('poll_answer', (answer) => {
        const userId = answer.user.id;
        const displayName = answer.user.username ? `@${answer.user.username}` : answer.user.first_name;

        if (!userStreaks[userId]) {
            userStreaks[userId] = { count: 0, username: displayName };
        }

        const selectedOption = answer.option_ids[0];

        if (selectedOption === 0) {
            userStreaks[userId].count += 1;
        } else {
            userStreaks[userId].count = 0;
        }

        console.log(`${displayName} — ${userStreaks[userId].count} подряд`);

        if (userStreaks[userId].count === 3) {
            bot.sendMessage(
                process.env.CHAT_ID,
                `🎉 ${displayName} красавчик! 3 тренировки подряд! 💪`
            );
        }

        if (selectedOption === 1) {
            const insult = insults[Math.floor(Math.random() * insults.length)];
            bot.sendMessage(process.env.CHAT_ID, insult.replace("${displayName}", displayName));
        }
    });
};
