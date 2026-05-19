export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token saknas' });

  try {
    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return res.status(401).json({ error: 'Inloggningen har gått ut. Koppla om Google Search Console.' });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: `Google svarade med fel ${response.status}` });
    }

    const data = await response.json();
    const sites = (data.siteEntry || []).map(s => s.siteUrl);
    res.status(200).json({ sites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
