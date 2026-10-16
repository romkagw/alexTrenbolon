// Хранилище дневника в Redis.
//   day:<YYYY-MM-DD>   — список подходов за день (единственный источник правды)
//   days               — zset всех тренировочных дней
//   exdays:<exercise>  — zset дней, когда делалось упражнение
//   exercises          — set канонических названий упражнений
//   last_batch         — последняя запись, для отмены
const { redis } = require('./storage');
const { TIMEZONE } = require('../config');

const SET_FIELDS = ['weight', 'reps', 'duration_sec', 'distance_km'];

const dayKey = (day) => `day:${day}`;
const exDaysKey = (exercise) => `exdays:${exercise}`;
const dayScore = (day) => Date.parse(`${day}T00:00:00Z`) / 86400000;

function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

function assertDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(dayScore(day))) {
        throw new Error(`Некорректная дата: ${day}`);
    }
    return day;
}

function cleanSet(set) {
    const out = {};
    for (const field of SET_FIELDS) {
        if (typeof set[field] === 'number' && set[field] >= 0) out[field] = set[field];
    }
    if (set.note) out.note = String(set.note);
    return out;
}

// Подход без служебных полей — для ответов модели
const view = ({ id, exercise, ...set }) => set;

async function getDay(day) {
    return (await redis.lrange(dayKey(day), 0, -1)) || [];
}

async function getDays(days) {
    if (!days.length) return [];
    const pipeline = redis.pipeline();
    days.forEach((day) => pipeline.lrange(dayKey(day), 0, -1));
    return pipeline.exec();
}

async function listExercises() {
    const list = await redis.smembers('exercises');
    return list.sort((a, b) => a.localeCompare(b, 'ru'));
}

// Последние дни, когда делалось упражнение (строго раньше before, если задан)
function exerciseDays(exercise, { before, limit }) {
    const max = before ? dayScore(before) - 1 : '+inf';
    return redis.zrange(exDaysKey(exercise), max, '-inf', { byScore: true, rev: true, offset: 0, count: limit });
}

async function getSessions(exercise, { before, limit }) {
    const days = await exerciseDays(exercise, { before, limit });
    const lists = await getDays(days);
    return days.map((day, i) => ({
        day,
        sets: lists[i].filter((e) => e.exercise === exercise).map(view),
    }));
}

// Переписывает день целиком и чистит индексы, если что-то опустело
async function rewriteDay(day, entries, affectedExercises) {
    const tx = redis.multi();
    tx.del(dayKey(day));
    if (entries.length) {
        tx.rpush(dayKey(day), ...entries);
    } else {
        tx.zrem('days', day);
    }
    for (const exercise of affectedExercises) {
        if (!entries.some((e) => e.exercise === exercise)) tx.zrem(exDaysKey(exercise), day);
    }
    await tx.exec();
}

async function logSets({ exercise, sets, date }) {
    const day = assertDay(date || today());
    const name = String(exercise || '').trim();
    if (!name) throw new Error('Не указано упражнение');

    const ts = Date.now();
    const entries = [];
    for (const set of sets || []) {
        const count = Math.min(20, Math.max(1, Math.round(set.count || 1)));
        for (let i = 0; i < count; i++) {
            entries.push({ id: `${ts}-${entries.length}`, exercise: name, ...cleanSet(set) });
        }
    }
    if (!entries.length) throw new Error('Нет подходов для записи');

    const [previous] = await getSessions(name, { before: day, limit: 1 });

    const tx = redis.multi();
    tx.sadd('exercises', name);
    tx.rpush(dayKey(day), ...entries);
    tx.zadd('days', { score: dayScore(day), member: day });
    tx.zadd(exDaysKey(name), { score: dayScore(day), member: day });
    tx.set('last_batch', { day, ids: entries.map((e) => e.id) });
    await tx.exec();

    const todaySets = (await getDay(day)).filter((e) => e.exercise === name).map(view);
    return { day, exercise: name, logged: entries.length, sets_this_day: todaySets, previous_session: previous || null };
}

function estimate1RM(set) {
    if (!set.weight || !set.reps) return 0;
    return set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30);
}

async function getExerciseHistory({ exercise, sessions = 5 }) {
    const limit = Math.min(30, Math.max(1, sessions));
    const recent = await getSessions(exercise, { limit });
    const allDays = await redis.zrange(exDaysKey(exercise), 0, -1);
    const lists = await getDays(allDays);
    const allSets = lists.flatMap((entries, i) =>
        entries.filter((e) => e.exercise === exercise).map((e) => ({ day: allDays[i], ...view(e) }))
    );

    // Лучший подход по заданной метрике (при равенстве — самый ранний)
    const record = (score) => {
        const top = allSets.reduce((best, set) => (score(set) > score(best || {}) ? set : best), null);
        return top && score(top) ? top : null;
    };
    const best1RM = record(estimate1RM);

    return {
        exercise,
        total_sessions: allDays.length,
        first_day: allDays[0] || null,
        recent_sessions: recent,
        records: {
            max_weight: record((s) => s.weight || 0),
            max_reps: record((s) => s.reps || 0),
            best_estimated_1rm: best1RM ? { ...best1RM, e1rm_kg: Math.round(estimate1RM(best1RM) * 10) / 10 } : null,
        },
    };
}

async function getWorkout({ date }) {
    const day = assertDay(date || today());
    const entries = await getDay(day);
    const byExercise = {};
    for (const e of entries) {
        (byExercise[e.exercise] ||= []).push(view(e));
    }
    return { day, exercises: byExercise };
}

async function getStats({ from, to }) {
    const end = assertDay(to || today());
    const start = assertDay(from || end);
    if (dayScore(end) - dayScore(start) > 400) throw new Error('Слишком большой период, максимум ~год');

    const days = await redis.zrange('days', dayScore(start), dayScore(end), { byScore: true });
    const lists = await getDays(days);

    const exercises = {};
    let tonnage = 0;
    lists.forEach((entries, i) => {
        for (const e of entries) {
            const stat = (exercises[e.exercise] ||= { days: new Set(), sets: 0, reps: 0, tonnage_kg: 0, max_weight: 0 });
            stat.days.add(days[i]);
            stat.sets += 1;
            stat.reps += e.reps || 0;
            stat.tonnage_kg += (e.weight || 0) * (e.reps || 0);
            stat.max_weight = Math.max(stat.max_weight, e.weight || 0);
            tonnage += (e.weight || 0) * (e.reps || 0);
        }
    });
    for (const stat of Object.values(exercises)) {
        stat.sessions = stat.days.size;
        delete stat.days;
    }

    return { from: start, to: end, workouts: days.length, workout_days: days, total_tonnage_kg: tonnage, exercises };
}

async function undoLast() {
    const last = await redis.get('last_batch');
    if (!last) return { removed: 0, message: 'Нечего отменять' };

    const entries = await getDay(last.day);
    const removed = entries.filter((e) => last.ids.includes(e.id));
    const keep = entries.filter((e) => !last.ids.includes(e.id));
    await rewriteDay(last.day, keep, new Set(removed.map((e) => e.exercise)));
    await redis.del('last_batch');

    return { day: last.day, removed: removed.length, removed_sets: removed.map((e) => ({ exercise: e.exercise, ...view(e) })) };
}

async function deleteSets({ exercise, date }) {
    const day = assertDay(date || today());
    const entries = await getDay(day);
    const keep = entries.filter((e) => e.exercise !== exercise);
    const removed = entries.length - keep.length;
    if (removed) await rewriteDay(day, keep, [exercise]);
    return { day, exercise, removed };
}

// Переименование или слияние упражнений (например, две записи одного и того же)
async function renameExercise({ from, to }) {
    const target = String(to || '').trim();
    if (!target || from === target) throw new Error('Нужно новое название');

    const days = await redis.zrange(exDaysKey(from), 0, -1);
    const lists = await getDays(days);

    const tx = redis.multi();
    days.forEach((day, i) => {
        const entries = lists[i].map((e) => (e.exercise === from ? { ...e, exercise: target } : e));
        tx.del(dayKey(day));
        tx.rpush(dayKey(day), ...entries);
        tx.zadd(exDaysKey(target), { score: dayScore(day), member: day });
    });
    tx.del(exDaysKey(from));
    tx.srem('exercises', from);
    tx.sadd('exercises', target);
    await tx.exec();

    return { from, to: target, days_updated: days.length };
}

module.exports = {
    today,
    listExercises,
    logSets,
    getExerciseHistory,
    getWorkout,
    getStats,
    undoLast,
    deleteSets,
    renameExercise,
};
