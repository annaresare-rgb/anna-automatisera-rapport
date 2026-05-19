export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { propertyId, period, token } = req.body;
  if (!propertyId || !period || !token) return res.status(400).json({ error: 'Missing parameters' });

  const [year, month] = period.split('-');
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month}-${lastDay}`;

  const report = (body) =>
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dateRanges: [{ startDate, endDate }], ...body }),
    }).then(r => r.json());

  try {
    const [organic, conversions, aiTraffic] = await Promise.all([
      report({
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }],
        dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
      }),
      report({
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'conversions' }, { name: 'totalRevenue' }],
        dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } },
      }),
      report({
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          orGroup: {
            expressions: [
              { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'chatgpt' } } },
              { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'perplexity' } } },
              { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'gemini' } } },
              { filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: 'copilot' } } },
            ],
          },
        },
      }),
    ]);

    res.status(200).json({ organic, conversions, aiTraffic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
