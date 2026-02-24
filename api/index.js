module.exports = (req, res) => {
  res.status(200).send(`
<!DOCTYPE html>
<html>
<head><title>MiintRadar Bot</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="font-size:3rem;margin:0">🦀 MiintRadar Bot</h1>
<p style="color:#888;margin-top:1rem">Online 24/7 via Vercel</p>
<p style="margin-top:2rem"><a href="https://t.me/MiintRadarBot" style="color:#00ff88">Open in Telegram →</a></p>
</div>
</body>
</html>
  `);
};
