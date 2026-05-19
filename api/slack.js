export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { channelId, token } = req.body;
  if (!channelId || !token) return res.status(400).json({ error: 'channelId och token krävs' });

  try {
    const r = await fetch(`https://slack.com/api/conversations.history?channel=${encodeURIComponent(channelId)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (!data.ok) return res.status(400).json({ error: `Slack-fel: ${data.error}` });

    const lines = (data.messages || [])
      .filter(m => m.type === 'message' && m.text && !m.bot_id)
      .map(m => {
        const date = new Date(Number(m.ts) * 1000).toISOString().split('T')[0];
        return `[${date}] ${m.text.replace(/<[^>]+>/g, '').trim()}`;
      })
      .filter(l => l.length > 10);

    res.status(200).json({ text: lines.join('\n') || 'Inga meddelanden hittades' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
