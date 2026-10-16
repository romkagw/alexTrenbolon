// GPT разбирает свободный текст (с ошибками, сленгом, сокращениями)
// и сам решает, какие действия с дневником выполнить
const openai = require('./openai');
const diary = require('./diary');
const { redis } = require('./storage');
const { OPENAI_MODEL, TIMEZONE } = require('../config');

const MAX_STEPS = 6;
const HISTORY_KEY = 'chat:history';
const HISTORY_LENGTH = 12;
const HISTORY_TTL = 6 * 60 * 60;

const setSchema = {
    type: 'object',
    properties: {
        weight: { type: 'number', description: 'Вес в кг. Для упражнений с собственным весом не указывать (или доп. вес)' },
        reps: { type: 'number', description: 'Повторения' },
        duration_sec: { type: 'number', description: 'Время в секундах (планка, кардио)' },
        distance_km: { type: 'number', description: 'Дистанция в км' },
        count: { type: 'number', description: 'Сколько одинаковых подходов (3x10 → count 3). По умолчанию 1' },
        note: { type: 'string', description: 'Заметка, если пользователь что-то уточнил (тяжело, с паузой, отказ и т.п.)' },
    },
};

const dateParam = { type: 'string', description: 'Дата YYYY-MM-DD. По умолчанию сегодня' };

const tools = [
    {
        name: 'log_sets',
        description: 'Записать выполненные подходы одного упражнения. Возвращает все подходы этого упражнения за день и прошлую тренировку для сравнения',
        parameters: {
            type: 'object',
            properties: {
                exercise: { type: 'string', description: 'Каноническое название упражнения' },
                sets: { type: 'array', items: setSchema },
                date: dateParam,
            },
            required: ['exercise', 'sets'],
        },
    },
    {
        name: 'get_exercise_history',
        description: 'Последние тренировки по упражнению и личные рекорды. Использовать, когда спрашивают, что было в прошлый раз, какой прогресс, сколько ставить',
        parameters: {
            type: 'object',
            properties: {
                exercise: { type: 'string' },
                sessions: { type: 'number', description: 'Сколько последних тренировок вернуть (по умолчанию 5)' },
            },
            required: ['exercise'],
        },
    },
    {
        name: 'get_workout',
        description: 'Все подходы за конкретный день',
        parameters: { type: 'object', properties: { date: dateParam } },
    },
    {
        name: 'get_stats',
        description: 'Статистика за период: число тренировок, по каждому упражнению подходы, повторения, тоннаж, макс. вес',
        parameters: {
            type: 'object',
            properties: {
                from: { type: 'string', description: 'Начало периода YYYY-MM-DD' },
                to: { type: 'string', description: 'Конец периода YYYY-MM-DD, по умолчанию сегодня' },
            },
            required: ['from'],
        },
    },
    {
        name: 'undo_last',
        description: 'Отменить последнюю запись (последний вызов log_sets)',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'delete_sets',
        description: 'Удалить все подходы упражнения за день',
        parameters: {
            type: 'object',
            properties: { exercise: { type: 'string' }, date: dateParam },
            required: ['exercise'],
        },
    },
    {
        name: 'rename_exercise',
        description: 'Переименовать упражнение или слить его с другим (вся история переносится)',
        parameters: {
            type: 'object',
            properties: { from: { type: 'string' }, to: { type: 'string' } },
            required: ['from', 'to'],
        },
    },
].map((fn) => ({ type: 'function', function: fn }));

const handlers = {
    log_sets: diary.logSets,
    get_exercise_history: diary.getExerciseHistory,
    get_workout: diary.getWorkout,
    get_stats: diary.getStats,
    undo_last: diary.undoLast,
    delete_sets: diary.deleteSets,
    rename_exercise: diary.renameExercise,
};

async function systemPrompt() {
    const exercises = await diary.listExercises();
    const weekday = new Intl.DateTimeFormat('ru-RU', { timeZone: TIMEZONE, weekday: 'long' }).format(new Date());

    return [
        'Ты — личный дневник тренировок в Telegram. Пользователь пишет коротко, с ошибками, сленгом и сокращениями, иногда голосом (текст распознан и может быть кривым).',
        `Сегодня ${diary.today()}, ${weekday}.`,
        `Упражнения, которые уже есть в дневнике: ${exercises.length ? exercises.join('; ') : 'пока нет'}.`,
        '',
        'Правила:',
        '- Если пользователь сообщает, что сделал — запиши через log_sets. Одно упражнение — один вызов; несколько упражнений — несколько вызовов.',
        '- Название упражнения ВСЕГДА приводи к уже существующему из списка, если это то же самое упражнение (опечатки, синонимы, «жим лежа» = «Жим штанги лёжа»). Новое упражнение называй полно и понятно по-русски с заглавной буквы, например «Жим штанги лёжа», «Подтягивания», «Приседания со штангой».',
        '- Разбирай форматы: «80х8», «80 на 8», «3 по 10 по 60» (3 подхода × 10 повторов × 60 кг), «12 10 8» (три подхода с разным числом повторов), «+20кг» к собственному весу — это weight 20.',
        '- Если не хватает важного (непонятно, повторы это или вес) — переспроси коротко, ничего не записывая.',
        '- После записи коротко подтверди, что записано, и сравни с previous_session: прогресс, такой же результат или меньше. Если прошлых данных нет — скажи, что это первая запись.',
        '- Если спрашивают «что делал в прошлый раз», «сколько ставить» — возьми историю и предложи рабочий вес/повторы на сегодня (небольшая прогрессия, если прошлый раз все повторы выполнены). Веса округляй до шага 2,5 кг (гантели — 1–2 кг). Сравнивай с прошлым тренировочным днём, а не с подходами этого же дня.',
        '- Даты вроде «вчера», «в понедельник», «за неделю», «за месяц» переводи в YYYY-MM-DD относительно сегодняшней даты.',
        '- Ничего не выдумывай: цифры бери только из результатов инструментов.',
        '- Отвечай по-русски, кратко, по делу, обычным текстом без Markdown (можно эмодзи и переносы строк). Подходы пиши как 80×8.',
    ].join('\n');
}

async function loadHistory() {
    return (await redis.lrange(HISTORY_KEY, 0, -1)) || [];
}

async function saveHistory(userText, answer) {
    const tx = redis.multi();
    tx.rpush(HISTORY_KEY, { role: 'user', content: userText }, { role: 'assistant', content: answer });
    tx.ltrim(HISTORY_KEY, -HISTORY_LENGTH, -1);
    tx.expire(HISTORY_KEY, HISTORY_TTL);
    await tx.exec();
}

async function runTool(call) {
    const handler = handlers[call.function.name];
    if (!handler) return { error: `Неизвестный инструмент ${call.function.name}` };
    try {
        return await handler(JSON.parse(call.function.arguments || '{}'));
    } catch (e) {
        console.error(`Tool ${call.function.name} error`, e);
        return { error: e.message };
    }
}

async function reply(userText) {
    const messages = [
        { role: 'system', content: await systemPrompt() },
        ...(await loadHistory()),
        { role: 'user', content: userText },
    ];

    for (let step = 0; step < MAX_STEPS; step++) {
        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages,
            tools,
            max_completion_tokens: 1000,
        });
        const message = response.choices[0].message;
        messages.push(message);

        if (!message.tool_calls?.length) {
            const answer = message.content?.trim() || '🤔 Не понял, переформулируй';
            await saveHistory(userText, answer);
            return answer;
        }

        for (const call of message.tool_calls) {
            const result = await runTool(call);
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
    }

    return 'Что-то я запутался 🙃 Проверь последнюю тренировку и переформулируй.';
}

module.exports = { reply };
