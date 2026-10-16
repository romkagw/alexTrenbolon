const { OWNER_ID } = require('../config');
const { markOnce } = require('../services/storage');
const { reply } = require('../services/assistant');
const { transcribeVoice } = require('../services/voice');

const HELP = [
    '🏋️ Я твой дневник тренировок. Пиши как удобно — текстом или голосом:',
    '',
    '• жим лежа 80 на 8, 80х7, 85х5',
    '• подтягивания 12 10 8',
    '• присед 3 по 10 по 100',
    '• планка 2 по минуте',
    '',
    'Спрашивай:',
    '• что я делал в прошлый раз на жиме?',
    '• сколько ставить на присед?',
    '• статистика за месяц',
    '• что было вчера / в понедельник',
    '',
    'Исправления: «отмени последнее», «удали тягу за сегодня», «переименуй Жим в Жим штанги лёжа»',
    '',
    'Быстрые команды: /today /last /stats /undo',
].join('\n');

// Быстрые команды просто превращаются в запрос к ассистенту
const SHORTCUTS = {
    '/today': 'Покажи сегодняшнюю тренировку',
    '/last': 'Покажи последнюю тренировку (последний день, когда я занимался)',
    '/stats': 'Статистика за последние 30 дней',
    '/undo': 'Отмени последнюю запись',
};

const TELEGRAM_LIMIT = 4000;

async function sendLong(bot, chatId, text) {
    for (let i = 0; i < text.length; i += TELEGRAM_LIMIT) {
        await bot.sendMessage(chatId, text.slice(i, i + TELEGRAM_LIMIT));
    }
}

async function handleUpdate(bot, update) {
    // Telegram может повторить апдейт — не записываем подходы дважды
    if (update.update_id !== undefined && !(await markOnce(`update:${update.update_id}`, 24 * 60 * 60))) {
        return;
    }

    const msg = update.message;
    if (!msg) return;

    const chatId = msg.chat.id;
    const userId = String(msg.from?.id);

    if (!OWNER_ID) {
        return bot.sendMessage(chatId, `Твой Telegram id: ${userId}\nДобавь его в переменную OWNER_ID и передеплой.`);
    }
    if (userId !== String(OWNER_ID)) return;

    const command = msg.text?.split(/[\s@]/)[0];
    if (command === '/start' || command === '/help') {
        return bot.sendMessage(chatId, HELP);
    }

    await bot.sendChatAction(chatId, 'typing');

    let text = SHORTCUTS[command] || msg.text;
    let prefix = '';
    const voice = msg.voice || msg.audio;

    try {
        if (!text && voice) {
            text = await transcribeVoice(bot, voice.file_id);
            prefix = `🎙 «${text}»\n\n`;
        }
        if (!text) {
            return bot.sendMessage(chatId, 'Я понимаю текст и голосовые 🙂');
        }

        const answer = await reply(text);
        await sendLong(bot, chatId, prefix + answer);
    } catch (e) {
        console.error('Reply error', e);
        await bot.sendMessage(chatId, 'Не получилось обработать 😕 Попробуй ещё раз.');
    }
}

module.exports = { handleUpdate };
