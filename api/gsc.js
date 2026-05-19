export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { site, period, token } = req.body;
  if (!site || !period || !token) return res.status(400).json({ error: 'Missing parameters' });

  const [year, month] = period.split('-');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month}-${lastDay}`;

  const query = (dimensions, extra = {}) =>
    fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 25, ...extra }),
    }).then(r => r.json());

  try {
    // Test auth first with a simple overall query
    const overallRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions: [], rowLimit: 1 }),
    });

    if (overallRes.status === 401) {
      return res.status(401).json({ error: 'Google-inloggningen har gått ut. Koppla om Search Console i Inställningar.' });
    }
    if (overallRes.status === 403) {
      return res.status(403).json({ error: 'Du har inte åtkomst till den här webbplatsen i Search Console. Kontrollera att adressen stämmer.' });
    }
    if (!overallRes.ok) {
      const errText = await overallRes.text();
      console.error('GSC error:', overallRes.status, errText);
      return res.status(502).json({ error: `Google svarade med fel ${overallRes.status}` });
    }

    const overall = await overallRes.json();

    const [byPage, byQuery] = await Promise.all([
      query(['page']),
      query(['query']),
    ]);

    res.status(200).json({ overall, topPages: byPage, topQueries: byQuery });
  } catch (err) {
    console.error('GSC exception:', err);
    res.status(500).json({ error: err.message });
  }
}
