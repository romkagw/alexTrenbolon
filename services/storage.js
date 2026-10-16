const { Redis } = require('@upstash/redis');
const { REDIS_URL, REDIS_TOKEN } = require('../config');

if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("❌ Redis не настроен. Нужны KV_REST_API_URL и KV_REST_API_TOKEN");
}

const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });

// true, если ключ поставлен впервые — защита от повторной обработки
async function markOnce(key, ttlSeconds) {
    const result = await redis.set(key, 1, { nx: true, ex: ttlSeconds });
    return result === 'OK';
}

module.exports = { redis, markOnce };
