# Дневник тренировок (Telegram + GPT)

Личный бот-дневник: пишешь подходы как угодно (текстом или голосом, с ошибками), GPT понимает упражнение, записывает и сравнивает с прошлой тренировкой. Показывает историю, рекорды и статистику.

## Деплой на Vercel

1. Импортировать репозиторий в Vercel.
2. Storage → подключить **Upstash Redis** (переменные `KV_REST_API_URL` / `KV_REST_API_TOKEN` добавятся сами).
3. Environment Variables:
   - `TELEGRAM_TOKEN` — токен бота от @BotFather
   - `OPENAI_API_KEY`
   - `WEBHOOK_SECRET` — любая случайная строка
   - `OWNER_ID` — твой Telegram id (если не задан, бот пришлёт его в ответ на любое сообщение)
   - `OPENAI_MODEL` — необязательно, по умолчанию `gpt-4.1-mini`
4. После деплоя (с `TELEGRAM_TOKEN` и `WEBHOOK_SECRET` в локальном `.env`):
   `node scripts/set-webhook.js https://<проект>.vercel.app`

## Структура

- `api/webhook.js` — точка входа для Telegram
- `lib/handleUpdate.js` — доступ только владельцу, команды, голосовые
- `services/assistant.js` — GPT с инструментами (запись, история, статистика, отмена, переименование)
- `services/diary.js` — хранение подходов в Redis
- `index.js` — локальный запуск через polling (`npm start`, предварительно `deleteWebhook`)
