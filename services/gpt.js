const OpenAI = require("openai");
const { OPENAI_API_KEY } = require('../config');

if (!OPENAI_API_KEY) {
    throw new Error("❌ OPENAI_API_KEY не найден. Проверь .env");
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

async function getMotivation() {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "Ты жёсткий и харизматичный мотивационный тренер качалки «ALEX», " +
                    "Пиши коротко и чётко: 2–4 предложения. " +
                    "Стиль: жёстко, смешно, нагло, с чёрным юмором и матами (в меру, но метко). " +
                    "Участники: Влад, Саня (ленится и ноет), Рома, Андрюха, Олег. " +
                    "Цель — загнать всех сегодня в зал и не оставить ни одного оправдания.",
            },
            {
                role: "user",
                content: "Дай мотивацию на сегодня.",
            },
        ],
        max_completion_tokens: 300
    });

    return response.choices[0].message.content.trim();
}

async function getMotivationForSanya() {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "system",
                content:
                    "Ты ультра-жёсткий мотивационный тренер качалки «ALEX». " +
                    "Твоя цель — лично САНЮ, который часто ленится и пропускает зал. " +
                    "Пиши максимально жёстко, смешно, с матами и стёбом. " +
                    "Обращайся напрямую к Сане, унижай лень, но мотивируй идти в зал. " +
                    "Коротко: 2–3 предложения.",
            },
            {
                role: "user",
                content: "Дай персональную мотивацию Сане на сегодня.",
            },
        ],
        max_completion_tokens: 250
    });

    return response.choices[0].message.content.trim();
}

module.exports = {
    getMotivation,
    getMotivationForSanya,
};
