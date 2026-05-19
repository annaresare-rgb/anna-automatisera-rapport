const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Fetches recent Google algorithm update headlines from Search Engine Land RSS.
// Returns null on timeout/error so analysis can continue without it.
async function fetchSeoNews(period) {
  try {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 3000);

    const res = await fetch('https://searchengineland.com/feed', { signal: ac.signal });
    if (!res.ok) return null;
    const xml = await res.text();

    const [y, m] = period.split('-').map(Number);
    const cutoff = new Date(y, m - 4, 1); // 4 months back from selected period

    const items = [];
    for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/))?.[1];
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
      if (!title || !pubDate) continue;
      const date = new Date(pubDate);
      if (isNaN(date) || date < cutoff) continue;
      if (/google|core update|algorithm|ranking|penalty|spam update/i.test(title)) {
        items.push(`${date.toISOString().slice(0, 10)}: ${title}`);
      }
      if (items.length >= 8) break;
    }
    return items.length ? items.join('\n') : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { client, language, period, compareWith, reportFormat, data, clientProfile } = req.body;

  const langLabel = language === 'sv' ? 'svenska' : 'engelska';
  const compareLabel =
    compareWith === 'prev-month' ? 'föregående månad' :
    compareWith === 'prev-year' ? 'föregående år' :
    'föregående månad och föregående år';

  const formatInstructions = {
    email: 'Skriv som en välformulerad e-post redo att skickas till kunden. Löpande text i stycken, professionell men vänlig ton.',
    presentation: 'Skriv som underlag för en presentation. Använd tydliga rubriker och korta punktlistor. Varje punkt max en rad.',
    summary: 'Skriv en ledningssammanfattning på max 200 ord. Bara det viktigaste — nyckeltal och 2–3 slutsatser.',
  };

  const seoNews = await fetchSeoNews(period);

  const sections = [];
  const sourcesUsed = [];

  if (seoNews) sections.push(`## Senaste Google-uppdateringar och SEO-nyheter\n${seoNews}`);
  if (data.gsc) { sections.push(`## Google Search Console\n${data.gsc}`); sourcesUsed.push('Google Search Console'); }
  if (data.ga4) { sections.push(`## Google Analytics 4\n${data.ga4}`); sourcesUsed.push('GA4'); }
  if (data.ahrefs) { sections.push(`## Ahrefs\n${data.ahrefs}`); sourcesUsed.push('Ahrefs'); }
  if (data.wincher) { sections.push(`## Wincher (rankingar)\n${data.wincher}`); sourcesUsed.push('Wincher'); }
  if (data.sistrix) { sections.push(`## Sistrix (synlighet)\n${data.sistrix}`); sourcesUsed.push('Sistrix'); }
  if (data.historical) { sections.push(`## Historisk data\n${data.historical}`); sourcesUsed.push('Historisk data'); }
  if (data.slack) { sections.push(`## Slack (teamkommunikation)\n${data.slack}`); sourcesUsed.push('Slack'); }
  if (data.gmail) { sections.push(`## E-post (kundkommunikation)\n${data.gmail}`); sourcesUsed.push('E-post'); }
  if (data.trello) { sections.push(`## Trello (pågående arbete)\n${data.trello}`); sourcesUsed.push('Trello'); }

  const profileContext = [];
  if (clientProfile?.conversions) profileContext.push(`Konverteringar vi mäter: ${clientProfile.conversions}`);
  if (clientProfile?.importantMetrics) profileContext.push(`Extra viktiga metrics: ${clientProfile.importantMetrics}`);
  if (clientProfile?.brandKeywords) profileContext.push(`Brandord: ${clientProfile.brandKeywords}`);
  if (clientProfile?.contextNotes) profileContext.push(`Historik och förändringar:\n${clientProfile.contextNotes}`);

  const systemPrompt = `Du är en erfaren SEO-specialist med djup expertis inom alla delar av sökmotoroptimering. Du kombinerar teknisk precision med strategiskt tänkande.

Din expertis täcker:
- Teknisk SEO: Core Web Vitals, crawlbarhet, strukturerad data, JavaScript SEO, hreflang, log file-analys
- On-page och innehåll: sökavsiktsanalys, E-E-A-T, topical authority, SERP-features
- Länkprofil och auktoritet: länkprospektering, toxiska mönster, digital PR
- Analytics: Google Search Console, GA4, Ahrefs, Sistrix, Wincher
- Algoritmer och uppdateringar: du vet exakt vilka core updates, spam updates och helpfulness-uppdateringar Google lanserat och när — koppla alltid trafiktoppar eller tapp till specifika uppdateringar om de sammanfaller i tid

Hur du svarar:
- Var specifik och konkret — ge actionbara rekommendationer, inte allmänna råd
- Använd alltid siffror och procentförändringar när data finns tillgänglig
- Kommentera alltid brand vs non-brand separat när datan finns
- Koppla trafik och rankingar till affärsmål (konverteringar, synlighet, intäkter)
- Om data visar trafiktapp eller -ökning — kontrollera alltid om det sammanfaller med en Google-uppdatering och nämn den vid namn (t.ex. "Google Core Update mars 2025")
- Prioritera: vad ger störst effekt?
- Ange alltid datakällan inom parentes efter varje påstående`;

  const prompt = `Kund: ${client}
Period: ${period}
Jämförelse: ${compareLabel}
${profileContext.length ? '\n## Kundkontext\n' + profileContext.join('\n') : ''}

---

${sections.join('\n\n')}

---

Format: ${formatInstructions[reportFormat] || formatInstructions.email}

Struktur:
1. **Sammanfattning** – Det viktigaste om den här perioden.
2. **Trend** – Om trenddata (6 månader) finns: beskriv riktningen i klick/sessioner i en mening (t.ex. "Trafiken ökade stadigt jan–mar, tappade i april–maj").
3. **Vad gick bra** – Positiva förändringar med siffror.
4. **Vad försämrades** – Negativa förändringar med siffror.
5. **Slutsatser** – 2–3 konkreta insikter.
6. **Nästa steg** – 1–2 åtgärder.

Skriv på ${langLabel}. Var specifik och använd siffror. Avsluta med "**Källor:** [lista]".`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const result = await response.json();
    const analysis = result.content[0].text;

    // Save report to Supabase
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          client_name: client,
          period,
          compare_with: compareWith,
          report_format: reportFormat || 'email',
          analysis_text: analysis,
          sources_used: sourcesUsed,
        }),
      });
    } catch (dbErr) {
      console.error('Could not save report:', dbErr);
    }

    res.status(200).json({ analysis, sourcesUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
