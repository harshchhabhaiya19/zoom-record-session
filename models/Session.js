const mongoose = require('mongoose');
const SessionSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  sessionDate: { type: Date, required: true },
  sessionStartISO: { type: Date, required: true },
  zoomMeetingId: { type: String, default: null },
  zoomMeetingUUID: { type: String, default: null },
  zoomJoinUrl: { type: String, default: null },
  topic: { type: String, default: null },
  durationMinutes: { type: Number, default: 60 },
  createdAt: { type: Date, default: Date.now }
});
SessionSchema.index({ batchId: 1, sessionStartISO: 1 }, { unique: true });
module.exports = mongoose.model('Session', SessionSchema);
