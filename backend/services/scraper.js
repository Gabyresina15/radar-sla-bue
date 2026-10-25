const { chromium } = require('playwright');

// Tus viajes fijos monitoreados 24/7
const TARGET_TRIPS = [
  { id: 'Diciembre', ida: '2026-12-17', vuelta: '2026-12-22', origin: 'SLA', dest: 'BUE' },
  { id: 'Verano', ida: '2027-01-12', vuelta: '2027-02-07', origin: 'SLA', dest: 'BUE' }
];

async function createStealthBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Salta'
  });

  // Ocultar propiedad navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  return { browser, context };
}

/**
 * Extrae el mejor precio real para cualquier fecha entre SLA y BUE
 */
async function scrapeFlightPrice({ id = 'Custom', ida, vuelta, origin = 'SLA', dest = 'BUE' }) {
  const { browser, context } = await createStealthBrowser();
  const page = await context.newPage();

  // URL de búsqueda directa en ARS
  const query = `Vuelos de ${origin} a ${dest} salida ${ida} regreso ${vuelta}`;
  const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}&curr=ARS&hl=es-AR`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4500); // Esperar hidratación de precios dinámicos

    // Extraer tarjetas de vuelos del DOM renderizado
    const results = await page.evaluate(() => {
      const items = [];
      const cards = document.querySelectorAll('li');

      cards.forEach((card) => {
        const text = card.innerText || '';
        // Busca patrones de precio en ARS (ej: "$ 145.200" o "ARS 145,200")
        const priceMatch = text.match(/(?:\$|ARS)\s*([0-9]{2,3}(?:\.[0-9]{3})+)/);
        if (priceMatch && (text.includes('JetSMART') || text.includes('Flybondi') || text.includes('Aerolíneas'))) {
          const cleanPrice = parseInt(priceMatch[1].replace(/\./g, ''), 10);
          let airline = 'Otra';
          if (text.includes('JetSMART')) airline = 'JetSMART';
          else if (text.includes('Flybondi')) airline = 'Flybondi';
          else if (text.includes('Aerolíneas')) airline = 'Aerolíneas Argentinas';

          const isDirect = text.toLowerCase().includes('directo');
          items.push({
            airline,
            price: cleanPrice,
            details: isDirect ? 'Directo (Ida y Vuelta)' : 'Con escala'
          });
        }
      });

      return items.sort((a, b) => a.price - b.price);
    });

    await browser.close();

    if (!results.length) {
      throw new Error('No se encontraron tarifas renderizadas en el DOM.');
    }

    // Priorizar el más barato (y destacamos si hay JetSMART cerca del mínimo)
    const bestOverall = results[0];
    return {
      tripId: id,
      origin,
      destination: dest,
      departureDate: ida,
      returnDate: vuelta,
      airline: bestOverall.airline,
      price: bestOverall.price,
      details: bestOverall.details,
      bookingUrl: url
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Escanea la home y respuestas de red de JetSMART buscando códigos promocionales activos
 */
async function sniffJetSmartPromos() {
  const { browser, context } = await createStealthBrowser();
  const page = await context.newPage();
  const detectedPromos = new Set();

  // 1. Interceptor de tráfico XHR/JSON por si mandan el código por API interna
  page.on('response', async (response) => {
    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('application/json')) {
        const text = await response.text();
        const matches = text.match(/\b(NOCHEJS|VOYJS|CYBERJS|SMART[A-Z0-9]{2,6}|PROMO[A-Z0-9]{2,6})\b/g);
        if (matches) matches.forEach((m) => detectedPromos.add(m));
      }
    } catch (_) {}
  });

  try {
    await page.goto('https://jetsmart.com/ar/es/', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(4000);

    // 2. Escaneo de texto visible en banners promocionales de la Home
    const bodyText = await page.evaluate(() => document.body.innerText);
    const regexCodigo = /(?:c[oó]digo|cup[oó]n|usando|ingresando)\s*:?\s*([A-Z0-9]{4,12})/gi;
    let match;
    while ((match = regexCodigo.exec(bodyText)) !== null) {
      const candidate = match[1].toUpperCase();
      if (!['PARA', 'COMO', 'DESDE', 'HASTA', 'JETSMART'].includes(candidate)) {
        detectedPromos.add(candidate);
      }
    }

    await browser.close();
    return Array.from(detectedPromos);
  } catch (err) {
    await browser.close();
    console.error('[!] Error escaneando promos JetSMART:', err.message);
    return [];
  }
}

module.exports = { TARGET_TRIPS, scrapeFlightPrice, sniffJetSmartPromos };
