// План на тренировку относительно прошлого раза (двойная прогрессия)
// и сверка сделанных сегодня подходов с этим планом
const { formatSet } = require('../lib/format');

const REPS_TO_ADD_WEIGHT = 10; // дошёл до 10+ ровных повторов — добавляем вес
const STRENGTH_REPS = 5;       // до 5 повторов — силовой режим, растим вес
const WARMUP_RATIO = 0.8;      // подход легче 80% планового веса — разминка

const weightStep = (w) => (w >= 40 ? 2.5 : w >= 10 ? 2 : 1);
const round = (n) => Math.round(n * 10) / 10;
const list = (sets) => sets.map(formatSet).join(', ');

function weightedPlan(sets) {
    const top = Math.max(...sets.map((s) => s.weight));
    const work = sets.filter((s) => s.weight === top);
    const maxReps = Math.max(...work.map((s) => s.reps));
    const even = work.every((s) => s.reps === maxReps);
    const step = weightStep(top);

    if (!even) {
        return {
            target: work.map(() => ({ weight: top, reps: maxReps })),
            rule: `повторы падали — добей все подходы до ${top}×${maxReps}`,
        };
    }
    if (maxReps <= STRENGTH_REPS) {
        return {
            target: work.map(() => ({ weight: top + step, reps: maxReps })),
            rule: `все подходы сделаны — добавь ${step} кг`,
        };
    }
    if (maxReps < REPS_TO_ADD_WEIGHT) {
        return {
            target: work.map(() => ({ weight: top, reps: maxReps + 1 })),
            rule: 'все подходы сделаны — добавь по 1 повтору',
        };
    }
    return {
        target: work.map(() => ({ weight: top + step, reps: Math.max(6, maxReps - 2) })),
        rule: `дошёл до ${maxReps} повторов — добавь ${step} кг`,
    };
}

function repsPlan(sets) {
    const maxReps = Math.max(...sets.map((s) => s.reps));
    const even = sets.every((s) => s.reps === maxReps);
    return {
        target: sets.map((s) => ({ reps: even || s.reps < maxReps ? s.reps + 1 : s.reps })),
        rule: even ? 'добавь по 1 повтору в каждом подходе' : 'подтяни отстающие подходы на 1 повтор',
    };
}

function durationPlan(sets) {
    return {
        target: sets.map((s) => ({ duration_sec: Math.max(s.duration_sec + 5, Math.round((s.duration_sec * 1.1) / 5) * 5) })),
        rule: 'добавь ~10% времени',
    };
}

// previous — прошлая тренировка этого упражнения { day, sets }
function suggestPlan(previous) {
    if (!previous?.sets.length) return null;
    const { sets } = previous;

    const weighted = sets.filter((s) => s.weight && s.reps);
    const repsOnly = sets.filter((s) => !s.weight && s.reps);
    const timed = sets.filter((s) => !s.reps && s.duration_sec);

    const plan = weighted.length ? weightedPlan(weighted)
        : repsOnly.length ? repsPlan(repsOnly)
            : timed.length ? durationPlan(timed)
                : { target: sets, rule: 'повтори прошлый результат' };

    return {
        previous_day: previous.day,
        previous_sets: sets,
        target_sets: plan.target,
        rule: plan.rule,
        text: `🎯 Прошлый раз (${previous.day.slice(8, 10)}.${previous.day.slice(5, 7)}): ${list(sets)}\nСегодня: ${list(plan.target)} — ${plan.rule}`,
    };
}

// Сравнение подхода с плановым: что лучше, что хуже
function compareSet(set, target) {
    if (target.weight) {
        if ((set.weight || 0) > target.weight) return { ok: true, text: `тяжелее плана на ${round(set.weight - target.weight)} кг 💪` };
        if ((set.weight || 0) < target.weight) return { ok: false, text: `легче плана на ${round(target.weight - (set.weight || 0))} кг` };
    }
    const key = target.reps !== undefined ? 'reps' : target.duration_sec !== undefined ? 'duration_sec' : null;
    if (!key) return { ok: true, text: 'записал' };

    const unit = key === 'reps' ? 'повт.' : 'сек';
    const diff = (set[key] || 0) - target[key];
    if (diff > 0) return { ok: true, text: `по плану и +${diff} ${unit} сверху 🔥` };
    if (diff === 0) return { ok: true, text: 'по плану' };
    return { ok: false, text: `на ${-diff} ${unit} меньше плана (${formatSet(target)})` };
}

// Сверка подходов за сегодня с планом. todaySets — все подходы упражнения за день
function checkPlan(plan, todaySets) {
    if (!plan) return null;

    const targetWeight = Math.max(0, ...plan.target_sets.map((s) => s.weight || 0));
    const isWarmup = (s) => targetWeight > 0 && (s.weight || 0) < targetWeight * WARMUP_RATIO;
    const work = todaySets.filter((s) => !isWarmup(s));
    const last = todaySets[todaySets.length - 1];
    const total = plan.target_sets.length;

    if (isWarmup(last)) {
        return { text: `🔸 ${formatSet(last)} — разминка, в план не считаю. Первый рабочий: ${formatSet(plan.target_sets[0])}` };
    }

    const n = work.length;
    if (n > total) {
        return { text: `➕ ${formatSet(last)} — подход сверх плана 👍` };
    }

    const result = compareSet(last, plan.target_sets[n - 1]);
    const lines = [`${result.ok ? '✅' : '⚠️'} Подход ${n}/${total}: ${formatSet(last)} — ${result.text}`];

    if (n < total) {
        lines.push(`Следующий: ${formatSet(plan.target_sets[n])}`);
    } else {
        const allOk = work.slice(0, total).every((s, i) => compareSet(s, plan.target_sets[i]).ok);
        lines.push(allOk ? '🏁 План выполнен! Можно ещё подход сверху или заканчивать.' : '🏁 Подходы по плану закончены. Не всё добито — в следующий раз цель останется той же.');
    }
    return { text: lines.join('\n') };
}

module.exports = { suggestPlan, checkPlan };
