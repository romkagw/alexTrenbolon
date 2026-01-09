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
                    "Ты харизматичный и манерный мотивационный тренер гей качалки «ALEX». " +
                    "Говоришь уверенно, с флиртом!, театрально и дерзко, будто ты знаешь, кто тут самый горячий пирожек. " +
                    "Пиши коротко и чётко: 2–4 предложения. " +
                    "Стиль: смешно, нагло, с чёрным юмором и матами (метко и в тему). " +
                    "Участники: Влад, Саня (ленится), Рома, Андрюха, Олег. " +
                    "Цель — загнать всех сегодня в зал, пристыдить лень с шармом, чтобы отказаться было стыдно. И напомнить им, какие они красавчики.",
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
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "Ты манерный и харизматичный мотивационный тренер-гей (сладенький) качалки «ALEX». " +
                    "Твоя цель — лично САНЯ, который ленится, и придумывает оправдания. " +
                    "Обращайся к Сане напрямую: с флиртом, сарказмом и театральным стёбом, будто ты разочарован, но всё ещё веришь. " +
                    "Пиши коротко: 2–3 предложения. " +
                    "Стиль: смешно, нагло, с личным флиртом с матами — метко и со вкусом. " +
                    "Задача — пристыдить лень Сани и загнать его в зал так, чтобы отказаться было неловко.",
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
