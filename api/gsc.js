export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { site, period, token, compareWith = 'prev-month', brandKeywords = '' } = req.body;
  if (!site || !period || !token) return res.status(400).json({ error: 'Missing parameters' });

  const [y, m] = period.split('-').map(Number);

  function periodDates(year, month) {
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${lastDay}`, label: `${year}-${mm}` };
  }

  const cur = periodDates(y, m);
  const prevM = m === 1 ? periodDates(y - 1, 12) : periodDates(y, m - 1);
  const prevY = periodDates(y - 1, m);

  const gscFetch = (startDate, endDate, dimensions, extra = {}) =>
    fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 25, ...extra }),
    }).then(r => r.json());

  try {
    const authRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: cur.start, endDate: cur.end, dimensions: [], rowLimit: 1 }),
      }
    );
    if (authRes.status === 401) return res.status(401).json({ error: 'Google-inloggningen har gått ut. Koppla om Search Console i Inställningar.' });
    if (authRes.status === 403) return res.status(403).json({ error: 'Du har inte åtkomst till den här webbplatsen i Search Console. Kontrollera att adressen stämmer.' });
    if (!authRes.ok) return res.status(502).json({ error: `Google svarade med fel ${authRes.status}` });

    const overall = await authRes.json();

    // Build brand regex: "nordichair, nordic chair" → "nordichair|nordic chair"
    const brandRegex = brandKeywords
      .split(',').map(s => s.trim()).filter(Boolean).join('|');

    // Fetch pages, queries and comparison periods in parallel
    const compPeriods = [];
    if (compareWith === 'prev-month' || compareWith === 'both') compPeriods.push({ dates: prevM, label: `Föregående månad (${prevM.label})` });
    if (compareWith === 'prev-year' || compareWith === 'both') compPeriods.push({ dates: prevY, label: `Föregående år (${prevY.label})` });

    const brandFilter = (op) => ({
      dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: op, expression: brandRegex }] }],
    });

    const [byPage, byQuery, brandOverall, nonBrandOverall, ...compOveralls] = await Promise.all([
      gscFetch(cur.start, cur.end, ['page']),
      gscFetch(cur.start, cur.end, ['query']),
      brandRegex ? gscFetch(cur.start, cur.end, [], brandFilter('includingRegex')) : Promise.resolve(null),
      brandRegex ? gscFetch(cur.start, cur.end, [], brandFilter('excludingRegex')) : Promise.resolve(null),
      ...compPeriods.map(({ dates }) => gscFetch(dates.start, dates.end, [])),
    ]);

    function fmt(n) { return n != null ? Number(n).toLocaleString('sv-SE') : '—'; }
    function pct(curr, prev) {
      const c = Number(curr), p = Number(prev);
      if (!p) return '';
      const d = ((c - p) / p * 100);
      return ` (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`;
    }

    const cr = overall.rows?.[0];
    let text = `Aktuell period (${cur.label}):\n`;
    if (cr) {
      text += `Klick: ${fmt(cr.clicks)} | Impressions: ${fmt(cr.impressions)} | CTR: ${(cr.ctr * 100).toFixed(1)}% | Snittposition: ${cr.position.toFixed(1)}\n`;
    } else {
      text += `Ingen data för perioden.\n`;
    }

    compPeriods.forEach(({ label }, i) => {
      const pr = compOveralls[i]?.rows?.[0];
      if (!pr) return;
      text += `vs. ${label}: Klick: ${fmt(pr.clicks)}${pct(cr?.clicks, pr.clicks)} | Impressions: ${fmt(pr.impressions)}${pct(cr?.impressions, pr.impressions)} | CTR: ${(pr.ctr * 100).toFixed(1)}% | Snittposition: ${pr.position.toFixed(1)}\n`;
    });

    if (brandRegex && brandOverall?.rows?.[0] != null) {
      const br = brandOverall.rows[0];
      const nb = nonBrandOverall?.rows?.[0];
      text += `\nBrand vs Non-brand (${cur.label}):\n`;
      text += `Brand: Klick ${fmt(br.clicks)} | Impressions ${fmt(br.impressions)} | CTR ${(br.ctr * 100).toFixed(1)}% | Pos ${br.position.toFixed(1)}\n`;
      if (nb) text += `Non-brand: Klick ${fmt(nb.clicks)} | Impressions ${fmt(nb.impressions)} | CTR ${(nb.ctr * 100).toFixed(1)}% | Pos ${nb.position.toFixed(1)}\n`;
    }

    text += `\nTopp sidor (${cur.label}):\n`;
    (byPage.rows || []).slice(0, 10).forEach((r, i) => {
      text += `${i + 1}. ${r.keys[0]} — ${fmt(r.clicks)} klick, ${fmt(r.impressions)} imp, ${(r.ctr * 100).toFixed(1)}% CTR, pos ${r.position.toFixed(1)}\n`;
    });

    text += `\nTopp sökfraser (${cur.label}):\n`;
    (byQuery.rows || []).slice(0, 10).forEach((r, i) => {
      text += `${i + 1}. "${r.keys[0]}" — ${fmt(r.clicks)} klick, ${fmt(r.impressions)} imp, ${(r.ctr * 100).toFixed(1)}% CTR, pos ${r.position.toFixed(1)}\n`;
    });

    res.status(200).json({ text });
  } catch (err) {
    console.error('GSC exception:', err);
    res.status(500).json({ error: err.message });
  }
}
