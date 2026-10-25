import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [history, setHistory] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Estado para el buscador manual de fechas
  const [customIda, setCustomIda] = useState('2026-12-17');
  const [customVuelta, setCustomVuelta] = useState('2026-12-22');
  const [customResult, setCustomResult] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/dashboard`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
        setPromos(data.promos);
      }
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleInvestigate = async (e) => {
    e.preventDefault();
    setScanning(true);
    setCustomResult(null);
    try {
      const res = await fetch(`${API_URL}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ida: customIda, vuelta: customVuelta })
      });
      const data = await res.json();
      if (data.success) {
        setCustomResult(data.result);
        fetchDashboard();
      }
    } catch (err) {
      alert('Error consultando vuelo en vivo');
    } finally {
      setScanning(false);
    }
  };

  const getLatestByTrip = (tripId) => history.find((h) => h.tripId === tripId);
  const getMinByTrip = (tripId) => {
    const items = history.filter((h) => h.tripId === tripId);
    return items.length ? Math.min(...items.map((i) => i.price)) : null;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono p-4 max-w-xl mx-auto">
      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-emerald-400">RADAR // SLA ⇄ BUE</h1>
          <p className="text-xs text-zinc-400">Guerrilla Price & Promo Monitor</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="text-xs bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded hover:border-emerald-500 transition"
        >
          {loading ? 'Sincronizando...' : '↻ Actualizar'}
        </button>
      </header>

      {/* BANNER DE CÓDIGOS PROMOCIONALES DETECTADOS */}
      <section className="mb-6">
        <div className="bg-zinc-900/90 border border-amber-500/40 rounded-lg p-3">
          <div className="text-xs font-bold text-amber-400 uppercase mb-2">
            🎟 Códigos Promo Detectados (JetSMART)
          </div>
          {promos.length === 0 ? (
            <p className="text-xs text-zinc-400">
              Sin cupones activos en la home hoy. El sniffer revisa cada 4 hs.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {promos.map((p) => (
                <span key={p._id} className="bg-amber-500/10 border border-amber-500 text-amber-300 text-xs px-2 py-1 rounded font-bold">
                  {p.code}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* TARJETAS DE TUS 2 FECHAS OBJETIVO */}
      <section className="grid grid-cols-1 gap-4 mb-6">
        {[
          { id: 'Diciembre', label: 'Escapada Diciembre', dates: '17/12/2026 → 22/12/2026' },
          { id: 'Verano', label: 'Vacaciones Verano', dates: '12/01/2027 → 07/02/2027' }
        ].map((trip) => {
          const latest = getLatestByTrip(trip.id);
          const minPrice = getMinByTrip(trip.id);

          return (
            <div key={trip.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs text-emerald-400 font-bold uppercase">{trip.label}</span>
                  <h2 className="text-sm text-zinc-300">{trip.dates}</h2>
                </div>
                {latest && (
                  <span className="text-[11px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                    {latest.airline}
                  </span>
                )}
              </div>

              {latest ? (
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">
                      ${latest.price.toLocaleString('es-AR')} <span className="text-xs font-normal text-zinc-400">ARS</span>
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Mínimo histórico: <span className="text-emerald-400">${minPrice?.toLocaleString('es-AR')}</span>
                    </p>
                  </div>
                  <a
                    href={latest.bookingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-emerald-500 text-zinc-950 font-bold px-3 py-2 rounded hover:bg-emerald-400"
                  >
                    Ver Vuelo ↗
                  </a>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 mt-2">Esperando primer barrido del scraper...</p>
              )}
            </div>
          );
        })}
      </section>

      {/* INVESTIGADOR DE FECHAS EN VIVO */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <h3 className="text-xs font-bold text-zinc-300 uppercase mb-3">
          🔍 Investigar otra fecha en vivo (SLA ⇄ BUE)
        </h3>
        <form onSubmit={handleInvestigate} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Fecha Ida</label>
              <input
                type="date"
                value={customIda}
                onChange={(e) => setCustomIda(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Fecha Vuelta</label>
              <input
                type="date"
                value={customVuelta}
                onChange={(e) => setCustomVuelta(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="w-full bg-zinc-100 text-zinc-950 font-bold text-xs py-2 rounded hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {scanning ? 'Levantando Playwright Headless (10s)...' : 'Escanear Mejor Tarifa Ahora'}
          </button>
        </form>

        {customResult && (
          <div className="mt-4 p-3 bg-zinc-950 border border-emerald-500/40 rounded text-xs">
            <p className="text-emerald-400 font-bold">Resultado encontrado:</p>
            <p className="text-lg font-bold mt-1">
              ${customResult.price.toLocaleString('es-AR')} ARS ({customResult.airline})
            </p>
            <p className="text-zinc-400">{customResult.details}</p>
          </div>
        )}
      </section>

      {/* BITÁCORA DE CORRIDAS RECIENTES */}
      <section>
        <h3 className="text-xs font-bold text-zinc-400 uppercase mb-2">Últimos registros en MongoDB</h3>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {history.slice(0, 12).map((item) => (
            <div key={item._id} className="flex justify-between items-center bg-zinc-900/60 border border-zinc-800/80 px-3 py-2 rounded text-xs">
              <div>
                <span className="text-emerald-400 font-bold">[{item.tripId}]</span>{' '}
                <span className="text-zinc-300">{item.airline}</span>
                <span className="block text-[10px] text-zinc-500">
                  {item.departureDate} → {item.returnDate}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold text-white">${item.price.toLocaleString('es-AR')}</span>
                <span className="block text-[10px] text-zinc-500">
                  {new Date(item.scrapedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
