const mongoose = require('mongoose');
const RecordingSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  zoomRecordingId: String,
  fileType: String,
  fileSize: Number,
  duration: Number,
  s3Key: String,
  s3Url: String,
  status: { type: String, enum: ['uploaded','processing','failed'], default: 'uploaded' },
  recordedAt: Date,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Recording', RecordingSchema);
