export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { boardId, key, token } = req.body;
  if (!boardId || !key || !token) return res.status(400).json({ error: 'boardId, key och token krävs' });

  try {
    const [listsRes, cardsRes] = await Promise.all([
      fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`),
      fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&fields=name,desc,idList,labels,due,dateLastActivity`),
    ]);

    if (!listsRes.ok) return res.status(400).json({ error: 'Kunde inte hämta Trello-tavlan. Kontrollera Board ID och credentials.' });

    const lists = await listsRes.json();
    const cards = await cardsRes.json();

    const listMap = Object.fromEntries(lists.map(l => [l.id, l.name]));

    const byList = {};
    cards.forEach(c => {
      const listName = listMap[c.idList] || 'Okänd lista';
      if (!byList[listName]) byList[listName] = [];
      const labels = (c.labels || []).map(l => l.name).filter(Boolean).join(', ');
      const desc = c.desc ? ` — ${c.desc.slice(0, 120).replace(/\n/g, ' ')}` : '';
      byList[listName].push(`- ${c.name}${labels ? ` [${labels}]` : ''}${desc}`);
    });

    const text = Object.entries(byList)
      .map(([list, items]) => `### ${list}\n${items.join('\n')}`)
      .join('\n\n');

    res.status(200).json({ text: text.trim() || 'Inga kort på tavlan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
