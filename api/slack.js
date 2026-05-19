export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { channelId, token } = req.body;
  if (!channelId || !token) return res.status(400).json({ error: 'channelId och token krävs' });

  const headers = { Authorization: `Bearer ${token}` };

  function cleanText(text) {
    return text
      .replace(/<@[A-Z0-9]+\|([^>]+)>/g, '@$1')   // <@ID|name> → @name
      .replace(/<@[A-Z0-9]+>/g, '@användare')        // <@ID> → @användare
      .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1') // <url|text> → text
      .replace(/<https?:\/\/[^>]+>/g, '[länk]')      // bare url → [länk]
      .replace(/<[^>]+>/g, '')                        // övriga taggar bort
      .replace(/\s+/g, ' ')
      .trim();
  }

  try {
    // Hämta meddelanden och användarlista parallellt
    const [historyRes, usersRes] = await Promise.all([
      fetch(`https://slack.com/api/conversations.history?channel=${encodeURIComponent(channelId)}&limit=50`, { headers }),
      fetch('https://slack.com/api/users.list?limit=200', { headers }),
    ]);

    const history = await historyRes.json();
    if (!history.ok) return res.status(400).json({ error: `Slack-fel: ${history.error}` });

    const users = await usersRes.json();
    const userMap = {};
    if (users.ok) {
      (users.members || []).forEach(u => {
        userMap[u.id] = u.profile?.display_name || u.profile?.real_name || u.name;
      });
    }

    const lines = (history.messages || [])
      .filter(m => m.type === 'message' && m.text && !m.bot_id)
      .map(m => {
        const date = new Date(Number(m.ts) * 1000).toISOString().split('T')[0];
        const author = m.user ? (userMap[m.user] || m.user) : 'okänd';
        const text = cleanText(m.text);
        return text.length > 5 ? `[${date}] ${author}: ${text}` : null;
      })
      .filter(Boolean);

    res.status(200).json({ text: lines.join('\n') || 'Inga meddelanden hittades' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
