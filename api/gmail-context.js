export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query, token } = req.body;
  if (!query || !token) return res.status(400).json({ error: 'query och token krävs' });

  try {
    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=15`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (searchRes.status === 401) return res.status(401).json({ error: 'Gmail-inloggning utgången. Koppla om Gmail i Inställningar.' });
    if (!searchRes.ok) return res.status(502).json({ error: `Gmail svarade med fel ${searchRes.status}` });

    const searchData = await searchRes.json();
    const threads = searchData.threads || [];
    if (!threads.length) return res.status(200).json({ text: 'Inga mejlkonversationer hittades för sökningen.' });

    const details = await Promise.all(
      threads.slice(0, 10).map(t =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json())
      )
    );

    const lines = details.map(t => {
      const first = t.messages?.[0];
      const last = t.messages?.[t.messages.length - 1];
      const subject = first?.payload?.headers?.find(h => h.name === 'Subject')?.value || '(ingen ämnesrad)';
      const date = first?.payload?.headers?.find(h => h.name === 'Date')?.value?.slice(0, 16) || '';
      const snippet = last?.snippet || '';
      const count = t.messages?.length > 1 ? ` (${t.messages.length} meddelanden)` : '';
      return `[${date}] ${subject}${count}\n  ${snippet.slice(0, 200)}`;
    });

    res.status(200).json({ text: lines.join('\n\n') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
