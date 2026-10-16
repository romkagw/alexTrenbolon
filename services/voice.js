const { toFile } = require('openai');
const openai = require('./openai');

// Голосовое → текст, чтобы в зале не печатать
async function transcribeVoice(bot, fileId) {
    const link = await bot.getFileLink(fileId);
    const response = await fetch(link);
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await openai.audio.transcriptions.create({
        file: await toFile(buffer, 'voice.ogg'),
        model: 'whisper-1',
        language: 'ru',
    });
    return result.text.trim();
}

module.exports = { transcribeVoice };
