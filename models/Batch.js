const mongoose = require('mongoose');
const BatchSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  batchName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  sessionsPerWeek: { type: Number, default: 1 },
  sessionDaysOfWeek: { type: [Number], default: [1] },
  sessionStartTime: { type: String, default: '10:00' },
  sessionDurationMinutes: { type: Number, default: 60 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  instructorId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Batch', BatchSchema);
