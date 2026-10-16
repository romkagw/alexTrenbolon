// Графики через бесплатный QuickChart (Chart.js на их сервере), возвращает PNG
const diary = require('./diary');

const shortDay = (day) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

async function render(config) {
    const response = await fetch('https://quickchart.io/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart: config, width: 800, height: 450, backgroundColor: 'white', format: 'png', version: '4' }),
    });
    if (!response.ok) throw new Error(`QuickChart ответил ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

const line = (label, data, color) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    tension: 0.25,
    pointRadius: 4,
});

function lineChart(title, labels, datasets) {
    return render({
        type: 'line',
        data: { labels, datasets },
        options: {
            plugins: { title: { display: true, text: title, font: { size: 20 } } },
            scales: { y: { beginAtZero: false } },
        },
    });
}

async function exerciseChart(exercise, sessions = 20) {
    const points = await diary.getExerciseProgress(exercise, sessions);
    if (points.length < 2) throw new Error(`Для графика по «${exercise}» нужно хотя бы 2 тренировки`);

    const labels = points.map((p) => shortDay(p.day));
    const withWeight = points.some((p) => p.max_weight > 0);
    const datasets = withWeight
        ? [
            line('Макс. вес, кг', points.map((p) => p.max_weight), '#2563eb'),
            line('Расчётный 1ПМ, кг', points.map((p) => p.e1rm), '#f97316'),
        ]
        : [line('Повторений за тренировку', points.map((p) => p.total_reps), '#2563eb')];

    return lineChart(exercise, labels, datasets);
}

async function bodyWeightChart(days = 90) {
    const points = await diary.getBodyWeightHistory(days);
    if (points.length < 2) throw new Error('Для графика веса нужно хотя бы 2 записи');
    return lineChart('Вес тела', points.map((p) => shortDay(p.day)), [line('Вес, кг', points.map((p) => p.weight), '#16a34a')]);
}

module.exports = { exerciseChart, bodyWeightChart };
