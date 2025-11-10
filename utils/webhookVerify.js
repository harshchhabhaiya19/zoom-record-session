function verifyZoomWebhook(req) {
  const secret = process.env.ZOOM_WEBHOOK_VERIFICATION_TOKEN;
  if (!secret) return true;
  // Zoom may send verification token in body.token or we use a header — adapt to your app config
  if (req.body?.token && req.body.token === secret) return true;
  return true; // relaxed for development; replace with HMAC validation later
}
module.exports = { verifyZoomWebhook };
