require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const { PriceLog, PromoLog } = require('./models/RadarData');
const { TARGET_TRIPS, scrapeFlightPrice, sniffJetSmartPromos } = require('./services/scraper');
const { sendTelegramAlert } = require('./services/telegram');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('[+] MongoDB Atlas conectado'))
  .catch((err) => console.error('[!] Error MongoDB:', err));

const UMBRAL = parseFloat(process.env.UMBRAL_DESCUENTO || '0.12');

/**
 * Ciclo maestro: Corre el scraper para tus fechas clave + busca cupones en JetSMART
 */
async function runRadarCycle() {
  console.log(`[*] Iniciando barrido de radar: ${new Date().toISOString()}`);

  // 1. Buscar códigos promocionales en JetSMART
  const promos = await sniffJetSmartPromos();
  for (const code of promos) {
    const exists = await PromoLog.findOne({
      code,
      detectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (!exists) {
      await PromoLog.create({ code, description: 'Detectado en Home/API de JetSMART' });
      await sendTelegramAlert(`🔥 *CÓDIGO PROMOCIONAL DETECTADO EN JETSMART*\n\n🎟 Código: \`${code}\`\nEntrá ya a probarlo en tus fechas del 17/12 y Verano.`);
    }
  }

  // 2. Escanear precios de tus fechas objetivo
  for (const trip of TARGET_TRIPS) {
    try {
      const result = await scrapeFlightPrice(trip);

      // Calcular promedio histórico para ese tramo antes de guardar el nuevo
      const stats = await PriceLog.aggregate([
        { $match: { departureDate: trip.ida, returnDate: trip.vuelta } },
        { $group: { _id: null, avgPrice: { $avg: '$price' }, minPrice: { $min: '$price' }, count: { $sum: 1 } } }
      ]);

      await PriceLog.create(result);

      if (stats.length > 0 && stats[0].count >= 3) {
        const { avgPrice, minPrice } = stats[0];
        const discount = (avgPrice - result.price) / avgPrice;

        if (discount >= UMBRAL || result.price < minPrice) {
          await sendTelegramAlert(
            `🚨 *BAJÓN DE PRECIO: ${trip.id.toUpperCase()}* 🚨\n\n` +
            `✈️ *Aerolínea:* ${result.airline}\n` +
            `📅 *Fechas:* \`${trip.ida}\` al \`${trip.vuelta}\`\n` +
            `💰 *Precio hoy:* *$${result.price.toLocaleString('es-AR')} ARS*\n` +
            `📉 *Ahorro vs Promedio:* -${(discount * 100).toFixed(1)}% (Prom: $${Math.round(avgPrice).toLocaleString('es-AR')})\n` +
            `ℹ️ *Detalle:* ${result.details}`
          );
        }
      }
    } catch (err) {
      console.error(`[!] Falló barrido de ${trip.id}:`, err.message);
    }
  }
}

// --- ENDPOINTS PARA LA WEB APP ---

// 1. Obtener estado completo del Dashboard (Tus 2 viajes + Historial + Promos)
app.get('/api/dashboard', async (req, res) => {
  try {
    const history = await PriceLog.find().sort({ scrapedAt: -1 }).limit(60);
    const promos = await PromoLog.find().sort({ detectedAt: -1 }).limit(10);
    res.json({ success: true, history, promos, targetTrips: TARGET_TRIPS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Investigar una fecha personalizada en vivo desde el celular
app.post('/api/investigate', async (req, res) => {
  try {
    const { ida, vuelta, origin = 'SLA', dest = 'BUE' } = req.body;
    if (!ida || !vuelta) return res.status(400).json({ error: 'Faltan fechas de ida o vuelta' });

    const data = await scrapeFlightPrice({ id: 'Investigación Manual', ida, vuelta, origin, dest });
    const saved = await PriceLog.create(data);
    res.json({ success: true, result: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Forzar escaneo inmediato de tus fechas clave
app.post('/api/force-scan', async (req, res) => {
  runRadarCycle(); // Corre asíncrono para no colgar el request HTTP
  res.json({ success: true, message: 'Barrido iniciado en segundo plano.' });
});

// Cronjob cada 4 horas con Jitter aleatorio (0 a 25 min) para camuflar tráfico
cron.schedule('0 */4 * * *', () => {
  const jitterMs = Math.floor(Math.random() * 25 * 60 * 1000);
  setTimeout(runRadarCycle, jitterMs);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[+] Servidor Radar corriendo en puerto ${PORT}`);
  runRadarCycle(); // Primer barrido al levantar
});
