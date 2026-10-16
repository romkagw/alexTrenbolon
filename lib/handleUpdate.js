const { OWNER_ID } = require('../config');
const { markOnce } = require('../services/storage');
const { reply } = require('../services/assistant');
const { transcribeVoice } = require('../services/voice');
const diary = require('../services/diary');
const chart = require('../services/chart');
const { formatSet, formatRecords } = require('./format');

const HELP = [
    '🏋️ Я твой дневник тренировок. Пиши как удобно — текстом или голосом:',
    '',
    '• жим лежа 80 на 8, 80х7, 85х5',
    '• подтягивания 12 10 8',
    '• присед 3 по 10 по 100',
    '• планка 2 по минуте',
    '• вес 82.5 — вес тела',
    '',
    'По каждому упражнению я считаю план от прошлой тренировки (+повтор или +вес) и после каждого подхода говорю, идёшь ли ты по плану.',
    '',
    'Под каждой записью кнопки: ➕ ещё такой же подход, ↩️ отмена, 📈 график, 📋 история.',
    '',
    'Спрашивай:',
    '• что я делал в прошлый раз на жиме?',
    '• начинаю присед — дам план от прошлой тренировки',
    '• график жима за полгода',
    '• статистика за месяц',
    '',
    'Исправления: «отмени последнее», «удали тягу за сегодня», «переименуй Жим в Жим штанги лёжа»',
].join('\n');

// Кнопки нижнего меню и команды превращаются в запрос к ассистенту
const SHORTCUTS = {
    '📅 Сегодня': 'Покажи сегодняшнюю тренировку',
    '/today': 'Покажи сегодняшнюю тренировку',
    '🕘 Прошлая': 'Покажи последнюю тренировку (последний день, когда я занимался, не считая сегодня)',
    '/last': 'Покажи последнюю тренировку (последний день, когда я занимался, не считая сегодня)',
    '🏁 Итог': 'Подведи итог сегодняшней тренировки',
    '/summary': 'Подведи итог сегодняшней тренировки',
    '📊 Статистика': 'Статистика за последние 30 дней',
    '/stats': 'Статистика за последние 30 дней',
    '🏆 Рекорды': 'Покажи мои личные рекорды по всем упражнениям',
    '/records': 'Покажи мои личные рекорды по всем упражнениям',
    '⚖️ Вес тела': 'Покажи динамику веса тела с графиком',
    '/undo': 'Отмени последнюю запись',
};

const MENU = {
    keyboard: [
        [{ text: '📅 Сегодня' }, { text: '🕘 Прошлая' }, { text: '🏁 Итог' }],
        [{ text: '📊 Статистика' }, { text: '🏆 Рекорды' }, { text: '⚖️ Вес тела' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'жим 80х8, подтягивания 12 10 8…',
};

// Кнопки под сообщением о записи
const SET_ACTIONS = {
    inline_keyboard: [
        [{ text: '➕ Ещё подход', callback_data: 'repeat' }, { text: '↩️ Отменить', callback_data: 'undo' }],
        [{ text: '📈 График', callback_data: 'chart' }, { text: '📋 История', callback_data: 'history' }],
    ],
};

const TELEGRAM_LIMIT = 4000;

async function sendLong(bot, chatId, text, options) {
    for (let i = 0; i < text.length; i += TELEGRAM_LIMIT) {
        const isLast = i + TELEGRAM_LIMIT >= text.length;
        await bot.sendMessage(chatId, text.slice(i, i + TELEGRAM_LIMIT), isLast ? options : undefined);
    }
}

function sendPhoto(bot, chatId, image) {
    return bot.sendPhoto(chatId, image, {}, { filename: 'chart.png', contentType: 'image/png' });
}

async function sendAnswer(bot, chatId, { text, notes = [], photos, logged }, prefix = '') {
    const full = [prefix + text, ...notes].join('\n\n');
    await sendLong(bot, chatId, full, logged ? { reply_markup: SET_ACTIONS } : undefined);
    for (const image of photos) {
        await sendPhoto(bot, chatId, image);
    }
}

const isOwner = (user) => String(user?.id) === String(OWNER_ID);

async function handleMessage(bot, msg) {
    const chatId = msg.chat.id;

    if (!OWNER_ID) {
        return bot.sendMessage(chatId, `Твой Telegram id: ${msg.from?.id}\nДобавь его в переменную OWNER_ID и передеплой.`);
    }
    if (!isOwner(msg.from)) return;

    const command = msg.text?.split(/[\s@]/)[0];
    if (command === '/start' || command === '/help') {
        return bot.sendMessage(chatId, HELP, { reply_markup: MENU });
    }

    await bot.sendChatAction(chatId, 'typing');

    let text = SHORTCUTS[msg.text?.trim()] || SHORTCUTS[command] || msg.text;
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

        await sendAnswer(bot, chatId, await reply(text), prefix);
    } catch (e) {
        console.error('Reply error', e);
        await bot.sendMessage(chatId, 'Не получилось обработать 😕 Попробуй ещё раз.');
    }
}

// Кнопки под записью работают без GPT, кроме истории — так быстрее и бесплатно
const CALLBACKS = {
    async repeat(bot, chatId) {
        const result = await diary.repeatLast();
        const set = result.sets_this_day[result.sets_this_day.length - 1];
        let text = result.plan_check?.text || `➕ ${result.exercise}: ${formatSet(set)} — подход №${result.sets_this_day.length} сегодня`;
        if (result.new_records.length) text += `\n🏆 Новый рекорд: ${formatRecords(result.new_records)}!`;
        await bot.sendMessage(chatId, text, { reply_markup: SET_ACTIONS });
        return 'Записал ➕';
    },
    async undo(bot, chatId) {
        const result = await diary.undoLast();
        if (!result.removed) return 'Нечего отменять';
        const sets = result.removed_sets.map((s) => `${s.exercise} ${formatSet(s)}`).join(', ');
        await bot.sendMessage(chatId, `↩️ Удалено: ${sets}`);
        return 'Отменено';
    },
    async chart(bot, chatId) {
        const exercise = await diary.lastExercise();
        if (!exercise) return 'Нет последнего упражнения';
        await bot.sendChatAction(chatId, 'upload_photo');
        await sendPhoto(bot, chatId, await chart.exerciseChart(exercise));
        return null;
    },
    async history(bot, chatId) {
        const exercise = await diary.lastExercise();
        if (!exercise) return 'Нет последнего упражнения';
        await bot.sendChatAction(chatId, 'typing');
        await sendAnswer(bot, chatId, await reply(`Покажи историю последних тренировок и рекорды по упражнению «${exercise}»`));
        return null;
    },
};

async function handleCallback(bot, query) {
    if (!isOwner(query.from)) return bot.answerCallbackQuery(query.id);

    const action = CALLBACKS[query.data];
    const chatId = query.message?.chat.id;
    if (!action || !chatId) return bot.answerCallbackQuery(query.id);

    try {
        const notice = await action(bot, chatId);
        await bot.answerCallbackQuery(query.id, notice ? { text: notice } : {});
    } catch (e) {
        console.error(`Callback ${query.data} error`, e);
        await bot.answerCallbackQuery(query.id, { text: e.message || 'Ошибка 😕', show_alert: true });
    }
}

async function handleUpdate(bot, update) {
    // Telegram может повторить апдейт — не записываем подходы дважды
    if (update.update_id !== undefined && !(await markOnce(`update:${update.update_id}`, 24 * 60 * 60))) {
        return;
    }

    if (update.message) return handleMessage(bot, update.message);
    if (update.callback_query) return handleCallback(bot, update.callback_query);
}

module.exports = { handleUpdate };
