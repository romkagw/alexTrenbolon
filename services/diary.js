// Хранилище дневника в Redis.
//   day:<YYYY-MM-DD>   — список подходов за день (единственный источник правды)
//   days               — zset всех тренировочных дней
//   exdays:<exercise>  — zset дней, когда делалось упражнение
//   exercises          — set канонических названий упражнений
//   last_batch         — последняя запись, для отмены
//   last_exercise      — последнее записанное упражнение, для кнопок под записью
//   bodyweight         — hash день → вес тела
const { redis } = require('./storage');
const { TIMEZONE } = require('../config');
const { suggestPlan, checkPlan } = require('./progression');

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

// Все подходы упражнения за всю историю, с датой
async function exerciseSets(exercise) {
    const days = await redis.zrange(exDaysKey(exercise), 0, -1);
    const lists = await getDays(days);
    return lists.flatMap((entries, i) =>
        entries.filter((e) => e.exercise === exercise).map((e) => ({ day: days[i], ...view(e) }))
    );
}

function estimate1RM(set) {
    if (!set.weight || !set.reps) return 0;
    return set.reps === 1 ? set.weight : set.weight * (1 + set.reps / 30);
}

// Лучший подход по метрике (при равенстве — самый ранний)
function bestSet(sets, score) {
    const top = sets.reduce((best, set) => (score(set) > score(best || {}) ? set : best), null);
    return top && score(top) ? top : null;
}

const RECORD_METRICS = {
    max_weight: (s) => s.weight || 0,
    max_reps_bodyweight: (s) => (s.weight ? 0 : s.reps || 0),
    estimated_1rm: estimate1RM,
};

// Какие рекорды побиты новыми подходами (первая запись рекордом не считается)
function findNewRecords(history, newSets) {
    if (!history.length) return [];
    return Object.entries(RECORD_METRICS)
        .filter(([, score]) => {
            const before = Math.max(0, ...history.map(score));
            const now = Math.max(0, ...newSets.map(score));
            return now > before;
        })
        .map(([name]) => name);
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
    const history = await exerciseSets(name);

    const tx = redis.multi();
    tx.sadd('exercises', name);
    tx.rpush(dayKey(day), ...entries);
    tx.zadd('days', { score: dayScore(day), member: day });
    tx.zadd(exDaysKey(name), { score: dayScore(day), member: day });
    tx.set('last_batch', { day, ids: entries.map((e) => e.id) });
    tx.set('last_exercise', name);
    await tx.exec();

    const todaySets = (await getDay(day)).filter((e) => e.exercise === name).map(view);
    const plan = suggestPlan(previous);
    return {
        day,
        exercise: name,
        logged: entries.length,
        sets_this_day: todaySets,
        previous_session: previous || null,
        new_records: findNewRecords(history, entries),
        // План от прошлой тренировки показываем, когда упражнение только начато
        plan: todaySets.length === entries.length ? plan : null,
        plan_check: checkPlan(plan, todaySets),
    };
}

// План на сегодня по упражнению относительно прошлой тренировки + что уже сделано сегодня
async function getPlan({ exercise, date }) {
    const day = assertDay(date || today());
    const [previous] = await getSessions(exercise, { before: day, limit: 1 });
    const plan = suggestPlan(previous);
    if (!plan) return { exercise, plan: null, message: 'Прошлых тренировок нет — это будет первая, плана нет' };

    const todaySets = (await getDay(day)).filter((e) => e.exercise === exercise).map(view);
    return { exercise, plan, sets_this_day: todaySets, plan_check: todaySets.length ? checkPlan(plan, todaySets) : null };
}

// Кнопка «Ещё подход»: повторяет последний подход последнего упражнения (после отмены — предыдущий)
async function repeatLast() {
    const exercise = await lastExercise();
    const [session] = exercise ? await getSessions(exercise, { limit: 1 }) : [];
    if (!session) throw new Error('Нечего повторять — сначала запиши подход');

    const { note, ...set } = session.sets[session.sets.length - 1];
    return logSets({ exercise, sets: [set] });
}

function lastExercise() {
    return redis.get('last_exercise');
}

async function getExerciseHistory({ exercise, sessions = 5 }) {
    const limit = Math.min(30, Math.max(1, sessions));
    const recent = await getSessions(exercise, { limit });
    const allSets = await exerciseSets(exercise);
    const days = [...new Set(allSets.map((s) => s.day))];
    const best1RM = bestSet(allSets, estimate1RM);

    return {
        exercise,
        total_sessions: days.length,
        first_day: days[0] || null,
        recent_sessions: recent,
        records: {
            max_weight: bestSet(allSets, RECORD_METRICS.max_weight),
            max_reps: bestSet(allSets, (s) => s.reps || 0),
            best_estimated_1rm: best1RM ? { ...best1RM, e1rm_kg: round(estimate1RM(best1RM)) } : null,
        },
    };
}

async function getAllRecords() {
    const exercises = await listExercises();
    const records = {};
    for (const exercise of exercises) {
        const sets = await exerciseSets(exercise);
        if (!sets.length) continue;
        const best1RM = bestSet(sets, estimate1RM);
        records[exercise] = {
            max_weight: bestSet(sets, RECORD_METRICS.max_weight),
            max_reps: bestSet(sets, (s) => s.reps || 0),
            best_estimated_1rm_kg: best1RM ? round(estimate1RM(best1RM)) : null,
            last_day: sets[sets.length - 1].day,
        };
    }
    return { records };
}

// Точки для графика: по каждой тренировке лучший вес, расчётный 1ПМ и сумма повторов
async function getExerciseProgress(exercise, sessions = 20) {
    const list = await getSessions(exercise, { limit: Math.min(60, sessions) });
    return list.reverse().map(({ day, sets }) => ({
        day,
        max_weight: Math.max(0, ...sets.map((s) => s.weight || 0)),
        e1rm: round(Math.max(0, ...sets.map(estimate1RM))),
        total_reps: sets.reduce((sum, s) => sum + (s.reps || 0), 0),
    }));
}

const round = (n) => Math.round(n * 10) / 10;

async function logBodyWeight({ weight, date }) {
    const day = assertDay(date || today());
    if (typeof weight !== 'number' || weight <= 0) throw new Error('Некорректный вес');

    const history = await getBodyWeightHistory();
    const previous = [...history].reverse().find((p) => p.day < day) || null;
    await redis.hset('bodyweight', { [day]: weight });

    return { day, weight, previous, change_kg: previous ? round(weight - previous.weight) : null };
}

async function getBodyWeightHistory(days = 365) {
    const all = (await redis.hgetall('bodyweight')) || {};
    const minScore = dayScore(today()) - days;
    return Object.entries(all)
        .map(([day, weight]) => ({ day, weight: Number(weight) }))
        .filter((p) => dayScore(p.day) >= minScore)
        .sort((a, b) => a.day.localeCompare(b.day));
}

async function getBodyWeight({ days = 90 } = {}) {
    const history = await getBodyWeightHistory(days);
    if (!history.length) return { history: [], message: 'Вес тела ещё не записывался' };
    const first = history[0];
    const last = history[history.length - 1];
    return { history, change_kg: round(last.weight - first.weight), min: Math.min(...history.map((p) => p.weight)), max: Math.max(...history.map((p) => p.weight)) };
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

const tonnage = (sets) => sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

// Итог дня: по каждому упражнению — подходы, тоннаж, прошлая тренировка и побитые рекорды
async function getWorkoutSummary({ date }) {
    const day = assertDay(date || today());
    const { exercises } = await getWorkout({ date: day });

    const summary = {};
    for (const [exercise, sets] of Object.entries(exercises)) {
        const history = (await exerciseSets(exercise)).filter((s) => s.day < day);
        const [previous] = await getSessions(exercise, { before: day, limit: 1 });
        summary[exercise] = {
            sets,
            reps: sets.reduce((sum, s) => sum + (s.reps || 0), 0),
            tonnage_kg: tonnage(sets),
            previous_session: previous ? { ...previous, tonnage_kg: tonnage(previous.sets) } : null,
            new_records: findNewRecords(history, sets),
        };
    }
    const total = Object.values(summary).reduce((sum, e) => sum + e.tonnage_kg, 0);
    return { day, exercises: summary, total_tonnage_kg: total, total_sets: Object.values(summary).reduce((n, e) => n + e.sets.length, 0) };
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
    getWorkoutSummary,
    getStats,
    undoLast,
    deleteSets,
    renameExercise,
    repeatLast,
    getPlan,
    lastExercise,
    getAllRecords,
    getExerciseProgress,
    logBodyWeight,
    getBodyWeight,
    getBodyWeightHistory,
};
