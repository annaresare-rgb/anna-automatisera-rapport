import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const db = supabase();

  if (req.method === 'GET') {
    const { data, error } = await db.from('clients').select('*').order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const client = req.body;
    const { data, error } = await db
      .from('clients')
      .upsert({ ...client, updated_at: new Date().toISOString() }, { onConflict: 'name' })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  res.status(405).end();
}
