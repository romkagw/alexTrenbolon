// Подход в коротком виде: 80×8, 12 повт., 60 сек, 5 км
function formatSet(set) {
    const parts = [];
    if (set.weight && set.reps) parts.push(`${set.weight}×${set.reps}`);
    else if (set.weight) parts.push(`${set.weight} кг`);
    else if (set.reps) parts.push(`${set.reps} повт.`);
    if (set.duration_sec) parts.push(set.duration_sec >= 60 ? `${Math.round(set.duration_sec / 6) / 10} мин` : `${set.duration_sec} сек`);
    if (set.distance_km) parts.push(`${set.distance_km} км`);
    return parts.join(' ') || '—';
}

const RECORD_NAMES = {
    max_weight: 'максимальный вес',
    max_reps_bodyweight: 'максимум повторений',
    estimated_1rm: 'расчётный 1ПМ',
};

const formatRecords = (records) => records.map((r) => RECORD_NAMES[r] || r).join(', ');

module.exports = { formatSet, formatRecords };
