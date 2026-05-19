const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { client } = req.query;
  if (!client) return res.status(400).json({ error: 'client saknas' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/reports?client_name=eq.${encodeURIComponent(client)}&select=id,period,report_format,sources_used,created_at,analysis_text&order=created_at.desc&limit=20`,
      { headers }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
