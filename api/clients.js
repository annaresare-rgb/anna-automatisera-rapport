import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  try {
    const db = supabase();

    if (req.method === 'GET') {
      const { data, error } = await db.from('clients').select('*').order('name');
      if (error) { console.error('GET clients error:', error); return res.status(500).json({ error: error.message }); }
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      console.log('POST clients body:', JSON.stringify(req.body));
      const client = req.body;
      const { data, error } = await db
        .from('clients')
        .upsert({ ...client, updated_at: new Date().toISOString() }, { onConflict: 'name' })
        .select()
        .single();
      if (error) { console.error('POST clients error:', error); return res.status(500).json({ error: error.message }); }
      return res.status(200).json(data);
    }

    res.status(405).end();
  } catch (err) {
    console.error('clients handler exception:', err);
    res.status(500).json({ error: err.message });
  }
}
