export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client, language, period, compareWith, data } = req.body;

  const langLabel = language === 'sv' ? 'svenska' : 'engelska';
  const compareLabel =
    compareWith === 'prev-month' ? 'föregående månad' :
    compareWith === 'prev-year' ? 'föregående år' :
    'föregående månad och föregående år';

  const sections = [];
  if (data.gsc) sections.push(`## Google Search Console\n${data.gsc}`);
  if (data.ga4) sections.push(`## Google Analytics 4\n${data.ga4}`);
  if (data.sistrix) sections.push(`## Sistrix\n${data.sistrix}`);
  if (data.wincher) sections.push(`## Wincher\n${data.wincher}`);

  const prompt = `Du är en erfaren SEO-analytiker. Din uppgift är att analysera SEO-data för en kund och skriva en tydlig rapport.

Kund: ${client}
Period: ${period}
Jämförelse: ${compareLabel}

---

${sections.join('\n\n')}

---

Gör följande:

1. **Sammanfattning** – Vad är det viktigaste att veta om den här perioden? 2–3 meningar.

2. **Vad gick bra** – Lyft fram positiva förändringar med siffror.

3. **Vad försämrades** – Lyft fram negativa förändringar med siffror.

4. **Slutsatser** – 2–3 konkreta insikter baserade på datan.

5. **Förslag på nästa steg** – 1–2 konkreta åtgärder.

Skriv svaret på ${langLabel}. Var specifik och använd siffror. Skriv som om du pratar direkt till kunden — tydligt, vänligt och professionellt.`;

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const result = await response.json();
    const analysis = result.content[0].text;

    res.status(200).json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
