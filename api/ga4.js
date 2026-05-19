export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { propertyId, period, token, compareWith = 'prev-month' } = req.body;
  if (!propertyId || !period || !token) return res.status(400).json({ error: 'Missing parameters' });

  const [y, m] = period.split('-').map(Number);

  function periodDates(year, month) {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${lastDay}`, label: `${year}-${mm}` };
  }

  const cur = periodDates(y, m);
  const prevM = m === 1 ? periodDates(y - 1, 12) : periodDates(y, m - 1);
  const prevY = periodDates(y - 1, m);

  const runReport = (startDate, endDate, body) =>
    fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateRanges: [{ startDate, endDate }], ...body }),
    }).then(r => r.json());

  const organicFilter = {
    filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } },
  };

  try {
    const compPeriods = [];
    if (compareWith === 'prev-month' || compareWith === 'both') compPeriods.push({ dates: prevM, label: `Föregående månad (${prevM.label})` });
    if (compareWith === 'prev-year' || compareWith === 'both') compPeriods.push({ dates: prevY, label: `Föregående år (${prevY.label})` });

    const [curOrganic, curConv, aiTraffic, ...compResults] = await Promise.all([
      runReport(cur.start, cur.end, {
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: organicFilter,
      }),
      runReport(cur.start, cur.end, {
        metrics: [{ name: 'conversions' }, { name: 'totalRevenue' }],
        dimensionFilter: organicFilter,
      }),
      runReport(cur.start, cur.end, {
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
      // Comparison periods: organic + conversions per period
      ...compPeriods.flatMap(({ dates }) => [
        runReport(dates.start, dates.end, { metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: organicFilter }),
        runReport(dates.start, dates.end, { metrics: [{ name: 'conversions' }, { name: 'totalRevenue' }], dimensionFilter: organicFilter }),
      ]),
    ]);

    const comps = compPeriods.map((p, i) => ({
      label: p.label,
      organic: compResults[i * 2],
      conv: compResults[i * 2 + 1],
    }));

    function fmt(n) { return n != null ? Number(n).toLocaleString('sv-SE') : '—'; }
    function pct(curr, prev) {
      const c = Number(curr), p = Number(prev);
      if (!p) return '';
      const d = ((c - p) / p * 100);
      return ` (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`;
    }

    const curSessions = curOrganic.rows?.[0]?.metricValues?.[0]?.value;
    const curUsers = curOrganic.rows?.[0]?.metricValues?.[1]?.value;
    const curConvs = curConv.rows?.[0]?.metricValues?.[0]?.value;
    const curRevenue = curConv.rows?.[0]?.metricValues?.[1]?.value;

    let text = `Organisk trafik (${cur.label}):\nSessioner: ${fmt(curSessions)} | Användare: ${fmt(curUsers)}\n`;

    for (const c of comps) {
      const s = c.organic.rows?.[0]?.metricValues?.[0]?.value;
      const u = c.organic.rows?.[0]?.metricValues?.[1]?.value;
      if (s != null) text += `vs. ${c.label}: Sessioner: ${fmt(s)}${pct(curSessions, s)} | Användare: ${fmt(u)}${pct(curUsers, u)}\n`;
    }

    text += `\nKonverteringar organisk trafik (${cur.label}):\nKonverteringar: ${fmt(curConvs)}`;
    if (Number(curRevenue) > 0) text += ` | Omsättning: ${fmt(curRevenue)} kr`;
    text += '\n';

    for (const c of comps) {
      const cv = c.conv.rows?.[0]?.metricValues?.[0]?.value;
      if (cv != null) text += `vs. ${c.label}: Konverteringar: ${fmt(cv)}${pct(curConvs, cv)}\n`;
    }

    text += `\nAI-trafik (${cur.label}):\n`;
    if (aiTraffic.rows?.length) {
      aiTraffic.rows.forEach(r => {
        text += `${r.dimensionValues[0].value}: ${fmt(r.metricValues[0].value)} sessioner\n`;
      });
    } else {
      text += `Ingen AI-trafik registrerad.\n`;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
