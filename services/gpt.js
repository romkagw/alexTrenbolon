const OpenAI = require("openai");
const { OPENAI_API_KEY } = require('../config');

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

async function getMotivation() {
    const response = await openai.chat.completions.create({
        model: "gpt-5-nano", // 💰 максимально дёшево
        messages: [
            {
                role: "system",
                content:
                    "Ты жёсткий мотивационный тренер в качалке «ALEX». " +
                    "Пиши коротко (2–4 предложения), жёстко, смешно, с юмором и матами. " +
                    "Участники: Влад, Саня (ленится), Рома, Андрюха, Олег. " +
                    "Цель — загнать всех сегодня в зал.",
            },
            {
                role: "user",
                content: "Дай мотивацию на сегодня.",
            },
        ],
        max_tokens: 150,
        temperature: 0.9,
    });

    return response.choices[0].message.content.trim();
}

async function getMotivationForSanya() {
    const response = await openai.chat.completions.create({
        model: "gpt-5-nano",
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
        max_tokens: 120,
        temperature: 1.0,
    });

    return response.choices[0].message.content.trim();
}

module.exports = {
    getMotivation,
    getMotivationForSanya,
};
