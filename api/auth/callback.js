export default async function handler(req, res) {
  const { code, state: type } = req.query;

  if (!code) return res.status(400).send('Saknar kod från Google.');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    // Pass token back to frontend via query param (stored in localStorage)
    const param = type === 'ga4' ? 'ga4' : type === 'gmail' ? 'gmail' : 'gsc';
    res.redirect(`/?${param}=ok&token=${tokens.access_token}&refresh=${tokens.refresh_token || ''}`);
  } catch (err) {
    res.status(500).send('Inloggning misslyckades: ' + err.message);
  }
}
