const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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

  const sections = [];
  const sourcesUsed = [];

  if (data.gsc) { sections.push(`## Google Search Console\n${data.gsc}`); sourcesUsed.push('Google Search Console'); }
  if (data.ga4) { sections.push(`## Google Analytics 4\n${data.ga4}`); sourcesUsed.push('GA4'); }
  if (data.ahrefs) { sections.push(`## Ahrefs\n${data.ahrefs}`); sourcesUsed.push('Ahrefs'); }
  if (data.wincher) { sections.push(`## Wincher (rankingar)\n${data.wincher}`); sourcesUsed.push('Wincher'); }
  if (data.sistrix) { sections.push(`## Sistrix (synlighet)\n${data.sistrix}`); sourcesUsed.push('Sistrix'); }

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
- Algoritmer och uppdateringar: du förstår hur Googles core updates, spam updates och helpfulness-uppdateringar påverkar rankingar

Hur du svarar:
- Var specifik och konkret — ge actionbara rekommendationer, inte allmänna råd
- Använd alltid siffror och procentförändringar när data finns tillgänglig
- Kommentera alltid brand vs non-brand separat när datan finns
- Koppla trafik och rankingar till affärsmål (konverteringar, synlighet, intäkter)
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
2. **Vad gick bra** – Positiva förändringar med siffror.
3. **Vad försämrades** – Negativa förändringar med siffror.
4. **Slutsatser** – 2–3 konkreta insikter.
5. **Nästa steg** – 1–2 åtgärder.

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
