const axios = require('axios');
const qs = require('qs');

let cachedToken = null;

async function getS2SToken() {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.token;
  const clientId = process.env.ZOOM_S2S_CLIENT_ID;
  const clientSecret = process.env.ZOOM_S2S_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Zoom S2S credentials missing in .env');
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const params = qs.stringify({ grant_type: 'account_credentials', account_id: process.env.ZOOM_ACCOUNT_ID || '' });
  const url = `https://zoom.us/oauth/token?${params}`;
  const resp = await axios.post(url, null, { headers: { Authorization: `Basic ${auth}` } });
  const token = resp.data.access_token;
  const expires_in = resp.data.expires_in || 3600;
  cachedToken = { token, expires_at: Date.now() + (expires_in - 30) * 1000 };
  return token;
}

async function createMeeting({ topic='LMS Class', start_time, duration=60, timezone='Asia/Kolkata' } = {}) {
  const token = await getS2SToken();
  const url = 'https://api.zoom.us/v2/users/me/meetings';
  const body = { topic, type: 2, start_time: start_time ? new Date(start_time).toISOString() : undefined, duration, timezone, settings: { auto_recording: 'cloud' } };
  const resp = await axios.post(url, body, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  return resp.data;
}

async function getMeetingRecordings(meetingIdOrUUID) {
  const token = await getS2SToken();
  const url = `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingIdOrUUID)}/recordings`;
  const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return resp.data;
}

module.exports = { getS2SToken, createMeeting, getMeetingRecordings };
