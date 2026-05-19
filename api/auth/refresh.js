export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken saknas' });

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) return res.status(401).json({ error: 'Token-förnyelse misslyckades', detail: data });

    res.status(200).json({ accessToken: data.access_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
