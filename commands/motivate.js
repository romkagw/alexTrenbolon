const nodeCron = require("node-cron");
const { CHAT_ID } = require('../config');
const { getMotivation, getMotivationForSanya } = require('../services/gpt');


module.exports = (bot) => {

    bot.onText(/\/motivate/, async (msg) => {
        try {
            const motivation = await getMotivation();

            await bot.sendMessage(msg.chat.id, motivation, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔥 Ещё мотивацию", callback_data: "more_motivation" }],
                        [{ text: "🎯 На Саню", callback_data: "sanya_motivation" }],
                    ],
                },
            });
        } catch (e) {
            console.error(e);
            bot.sendMessage(msg.chat.id, "GPT сегодня не в форме 😕");
        }
    });

    bot.on("callback_query", async (query) => {
        try {
            if (query.data === "more_motivation") {
                const motivation = await getMotivation();

                await bot.sendMessage(query.message.chat.id, motivation, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔥 Ещё мотивацию", callback_data: "more_motivation" }],
                            [{ text: "🎯 На Саню", callback_data: "sanya_motivation" }],
                        ],
                    },
                });

                return bot.answerCallbackQuery(query.id);
            }

            if (query.data === "sanya_motivation") {
                const motivation = await getMotivationForSanya();

                await bot.sendMessage(query.message.chat.id, motivation, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔥 Добить ещё", callback_data: "sanya_motivation" }],
                            [{ text: "🔥 Общую мотивацию", callback_data: "more_motivation" }],
                        ],
                    },
                });

                return bot.answerCallbackQuery(query.id, {
                    text: "Саня под ударом 🎯",
                });
            }
        } catch (e) {
            console.error(e);
            bot.answerCallbackQuery(query.id, {
                text: "GPT сломался 😕",
                show_alert: true,
            });
        }
    });

    // ⏰ Автоматическая мотивация
    nodeCron.schedule('0 13 * * 1,3,5', async () => {
        try {
            const motivation = await getMotivation();
            bot.sendMessage(CHAT_ID, motivation);
        } catch (e) {
            console.error("Cron GPT error", e);
        }
    });
};
