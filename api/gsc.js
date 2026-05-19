export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { site, period, token } = req.body;
  if (!site || !period || !token) return res.status(400).json({ error: 'Missing parameters' });

  const [year, month] = period.split('-');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month}-${lastDay}`;

  const query = (dimensions, extra = {}) =>
    fetch(`https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 25, ...extra }),
    }).then(r => r.json());

  try {
    const [overall, byPage, byQuery, brand, nonBrand] = await Promise.all([
      query([]),
      query(['page']),
      query(['query']),
      query(['query'], { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'includingRegex', expression: process.env.BRAND_REGEX || '.*' }] }] }),
      query(['query'], { dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'excludingRegex', expression: process.env.BRAND_REGEX || '^$' }] }] }),
    ]);

    res.status(200).json({ overall, topPages: byPage, topQueries: byQuery, brand, nonBrand });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
