# Radar SLA ↔ BUE

Monitor de precios de vuelos en tiempo real entre Salta (SLA) y Buenos Aires (BUE) + sniffer de códigos promo de JetSMART.

## Estrategia
- Precios: Playwright contra Google Flights (curr=ARS) — evita Queue-it / Imperva de JetSMART.
- Promos: Sniffer en home de jetsmart.com/ar/es/ interceptando JSON + regex en DOM.

## Estructura
- `/backend` — Express + Mongoose + Playwright + node-cron + Telegram alerts
- `/frontend` — Vite + React + Tailwind dashboard (Telegram Mini App)

## Setup rápido

### Backend
```bash
cd backend
npm install
npx playwright install --with-deps chromium
cp .env.example .env   # completa MONGO_URI, TELEGRAM_TOKEN, etc.
npm start
```

### Frontend
```bash
cd frontend
npm install
# VITE_API_URL=https://tu-backend en .env.local
npm run dev
```

### Despliegue $0
- MongoDB Atlas M0
- Backend en Oracle Cloud Free Tier + PM2
- Frontend en Vercel
- Telegram Mini App via BotFather

Ver código para detalles de cron (cada 4h con jitter) y umbral de descuento.
