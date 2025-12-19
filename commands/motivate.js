const nodeCron = require("node-cron");
const { CHAT_ID } = require('../config');
const { getMotivation, getMotivationForSanya } = require('../services/gpt');

module.exports = (bot) => {

    // Функция безопасной отправки сообщений
    async function safeSendMessage(chatId, text, options = {}) {
        const message = text?.trim() || '💪 GPT пока молчит, мотивация не готова.';
        await bot.sendMessage(chatId, message, options);
    }

    // Команда /motivate
    bot.onText(/\/motivate/, async (msg) => {
        try {
            const motivation = await getMotivation();

            await safeSendMessage(msg.chat.id, motivation, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔥 Ещё мотивацию", callback_data: "more_motivation" }],
                        [{ text: "🎯 На Саню", callback_data: "sanya_motivation" }],
                    ],
                },
            });
        } catch (e) {
            console.error(e);
            await safeSendMessage(msg.chat.id, "GPT сегодня не в форме 😕");
        }
    });

    // Обработка кнопок
    bot.on("callback_query", async (query) => {
        try {
            if (query.data === "more_motivation") {
                const motivation = await getMotivation();

                await safeSendMessage(query.message.chat.id, motivation, {
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

                await safeSendMessage(query.message.chat.id, motivation, {
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

    // ⏰ Автоматическая мотивация по расписанию (Пн, Ср, Пт 13:00)
    nodeCron.schedule('0 13 * * 1,3,5', async () => {
        try {
            const motivation = await getMotivation();
            await safeSendMessage(CHAT_ID, motivation);
        } catch (e) {
            console.error("Cron GPT error", e);
        }
    });
};
