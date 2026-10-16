// Регистрирует webhook (сообщения и нажатия кнопок) и меню команд: node scripts/set-webhook.js https://<проект>.vercel.app
const { TOKEN, WEBHOOK_SECRET } = require('../config');

const baseUrl = process.argv[2];

if (!baseUrl || !TOKEN || !WEBHOOK_SECRET) {
    console.error('Использование: node scripts/set-webhook.js https://<проект>.vercel.app (нужны TELEGRAM_TOKEN и WEBHOOK_SECRET в .env)');
    process.exit(1);
}

async function call(method, body) {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    console.log(method, await response.json());
}

(async () => {
    await call('setWebhook', {
        url: `${baseUrl.replace(/\/$/, '')}/api/webhook`,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query'],
    });
    await call('setMyCommands', {
        commands: [
            { command: 'today', description: 'Тренировка за сегодня' },
            { command: 'last', description: 'Последняя тренировка' },
            { command: 'summary', description: 'Итог сегодняшней тренировки' },
            { command: 'stats', description: 'Статистика за 30 дней' },
            { command: 'records', description: 'Личные рекорды' },
            { command: 'undo', description: 'Отменить последнюю запись' },
            { command: 'help', description: 'Как пользоваться' },
        ],
    });
})();
