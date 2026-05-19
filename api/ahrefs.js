export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { domain, apiKey } = req.body;
  if (!domain || !apiKey) return res.status(400).json({ error: 'Missing domain or apiKey' });

  const key = apiKey || process.env.AHREFS_API_KEY;

  try {
    const [metrics, keywords] = await Promise.all([
      fetch(`https://api.ahrefs.com/v3/site-explorer/metrics?target=${encodeURIComponent(domain)}&mode=domain`, {
        headers: { Authorization: `Bearer ${key}` },
      }).then(r => r.json()),
      fetch(`https://api.ahrefs.com/v3/site-explorer/organic-keywords?target=${encodeURIComponent(domain)}&mode=domain&limit=20&order_by=traffic:desc`, {
        headers: { Authorization: `Bearer ${key}` },
      }).then(r => r.json()),
    ]);

    res.status(200).json({ metrics, topKeywords: keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
