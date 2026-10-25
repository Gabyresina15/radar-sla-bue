const axios = require('axios');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBAPP_URL = process.env.WEBAPP_URL;

async function sendTelegramAlert(text) {
  if (!TOKEN || !CHAT_ID) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
      reply_markup: WEBAPP_URL ? {
        inline_keyboard: [
          [{ text: '🚀 Abrir Radar WebApp', web_app: { url: WEBAPP_URL } }]
        ]
      } : undefined
    });
  } catch (err) {
    console.error('[!] Error enviando Telegram:', err.message);
  }
}

module.exports = { sendTelegramAlert };
