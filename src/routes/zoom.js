const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const Session = require('../models/Session');
const Recording = require('../models/Recording');
const { createMeeting, getS2SToken, getMeetingRecordings } = require('../services/zoomService');
const { uploadToS3 } = require('../services/s3Service');
const { verifyZoomWebhook } = require('../utils/webhookVerify');
const axios = require('axios');

/* helpers */
function parseTimeHHMM(str) {
  const [hh, mm] = (str || '00:00').split(':').map(Number);
  return { hh: hh || 0, mm: mm || 0 };
}
function generateSessionDates(startDate, endDate, sessionDaysOfWeek, sessionStartTime) {
  const results = [];
  const s = new Date(startDate); s.setHours(0,0,0,0);
  const e = new Date(endDate); e.setHours(23,59,59,999);
  const { hh, mm } = parseTimeHHMM(sessionStartTime);
  const cur = new Date(s);
  while (cur <= e) {
    if (sessionDaysOfWeek.includes(cur.getDay())) {
      const combined = new Date(cur);
      combined.setHours(hh, mm, 0, 0);
      results.push(new Date(combined));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return results;
}

/* schedule a batch */
router.post('/schedule-batch', async (req, res) => {
  try {
    const { courseName, batchName, startDate, endDate, sessionDaysOfWeek=[1], sessionStartTime='10:00', sessionDurationMinutes=60, timezone='Asia/Kolkata' } = req.body;
    if (!courseName || !batchName || !startDate || !endDate) return res.status(400).json({ ok:false, error:'missing required fields' });

    const batch = await Batch.create({ courseName, batchName, startDate: new Date(startDate), endDate: new Date(endDate), sessionsPerWeek: sessionDaysOfWeek.length, sessionDaysOfWeek, sessionStartTime, sessionDurationMinutes, timezone });

    const dates = generateSessionDates(batch.startDate, batch.endDate, sessionDaysOfWeek, sessionStartTime);
    const createdSessions = [];
    for (const dt of dates) {
      let sessionDoc;
      try {
        sessionDoc = await Session.create({ batchId: batch._id, sessionDate: dt, sessionStartISO: dt, durationMinutes: sessionDurationMinutes });
      } catch (err) {
        console.warn('session create warn', err.message);
        continue;
      }
      try {
        const topic = `${batch.batchName} - ${batch.courseName} (${dt.toDateString()})`;
        const zoom = await createMeeting({ topic, start_time: dt, duration: sessionDurationMinutes, timezone });
        sessionDoc.zoomMeetingId = String(zoom.id);
        sessionDoc.zoomMeetingUUID = zoom.uuid;
        sessionDoc.zoomJoinUrl = zoom.join_url;
        sessionDoc.topic = zoom.topic || topic;
        await sessionDoc.save();
      } catch (zoomErr) {
        console.warn('zoom create failed', zoomErr.message || zoomErr);
      }
      createdSessions.push(sessionDoc);
    }

    res.json({ ok:true, batch, sessionsCreated: createdSessions.length, sessions: createdSessions });
  } catch (err) {
    console.error('schedule-batch error', err);
    res.status(500).json({ ok:false, error: String(err) });
  }
});

/* list batches */
router.get('/batches', async (req, res) => {
  const batches = await Batch.find().sort({ createdAt:-1 }).lean();
  res.json(batches);
});

/* list sessions for a batch with recording if exists */
router.get('/sessions/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const sessions = await Session.find({ batchId }).sort({ sessionStartISO: 1 }).lean();
  const ids = sessions.map(s => s._id);
  const recs = await Recording.find({ sessionId: { $in: ids } }).lean();
  const map = {}; recs.forEach(r => (map[r.sessionId] = r));
  const result = sessions.map(s => ({ ...s, recording: map[s._id] || null }));
  res.json(result);
});

/* webhook: recording.completed */
router.post('/webhook', async (req, res) => {
  try {
    if (!verifyZoomWebhook(req)) return res.status(401).send('unauthorized');
    const event = req.body.event;
    if (event !== 'recording.completed') return res.status(200).send('ignored');

    const payloadObj = req.body.payload?.object;
    const meetingId = payloadObj?.id || payloadObj?.meeting_id;
    const meetingUUID = payloadObj?.uuid;

    console.log('recording.completed for meeting', meetingId, meetingUUID);

    // find session by zoomMeetingId
    const session = await Session.findOne({ zoomMeetingId: String(meetingId) });
    if (!session) {
      console.warn('no session match for meeting', meetingId);
      return res.status(200).send('no session');
    }

    // fetch recording files
    const token = await getS2SToken();
    const recordingsResp = await axios.get(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingUUID)}/recordings`, { headers: { Authorization: `Bearer ${token}` } });
    const files = recordingsResp.data.recording_files || [];
    for (const file of files) {
      if (!file.download_url) continue;
      // only mp4
      if (file.file_type && file.file_type.toUpperCase() !== 'MP4') continue;

      // download as arraybuffer (for upload)
      const downloadResp = await axios.get(file.download_url, { responseType: 'arraybuffer', headers: { Authorization: `Bearer ${token}` } });

      const key = `zoom-recordings/${session._id}/${file.id || Date.now()}.mp4`;
      const s3Url = await uploadToS3({ key, body: Buffer.from(downloadResp.data), contentType: 'video/mp4' });

      await Recording.create({
        sessionId: session._id,
        zoomRecordingId: file.id,
        fileType: file.file_type,
        fileSize: file.file_size,
        duration: file.duration,
        s3Key: key,
        s3Url,
        recordedAt: file.recording_start
      });

      console.log('uploaded recording to s3:', s3Url);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('webhook error', err.response?.data || err.message || err);
    res.status(500).send('server error');
  }
});

module.exports = router;
