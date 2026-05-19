const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=*&order=name`, { headers });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const client = { ...req.body, updated_at: new Date().toISOString() };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?on_conflict=name`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(client),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data });
      return res.status(200).json(Array.isArray(data) ? data[0] : data);
    }

    res.status(405).end();
  } catch (err) {
    const detail = { message: err.message, stack: err.stack, supabaseUrl: SUPABASE_URL ? 'set' : 'MISSING', supabaseKey: SUPABASE_KEY ? 'set' : 'MISSING' };
    console.error('clients error detail:', JSON.stringify(detail));
    res.status(500).json({ error: err.message, detail });
  }
}
