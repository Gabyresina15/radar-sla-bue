const mongoose = require('mongoose');

const PriceLogSchema = new mongoose.Schema({
  tripId: { type: String, required: true, index: true }, // "Diciembre", "Verano" o "Custom"
  origin: { type: String, default: 'SLA' },
  destination: { type: String, default: 'BUE' },
  departureDate: { type: String, required: true, index: true },
  returnDate: { type: String, required: true },
  airline: { type: String, required: true },
  price: { type: Number, required: true },
  details: { type: String },
  bookingUrl: { type: String },
  scrapedAt: { type: Date, default: Date.now, index: true }
});

const PromoLogSchema = new mongoose.Schema({
  code: { type: String, required: true },
  description: { type: String },
  detectedAt: { type: Date, default: Date.now }
});

module.exports = {
  PriceLog: mongoose.model('PriceLog', PriceLogSchema),
  PromoLog: mongoose.model('PromoLog', PromoLogSchema)
};
