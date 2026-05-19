import { createClient } from '@supabase/supabase-js';

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { client } = req.query;
  if (!client) return res.status(400).json({ error: 'client saknas' });

  const db = supabase();
  const { data, error } = await db
    .from('reports')
    .select('id, period, report_format, sources_used, created_at, analysis_text')
    .eq('client_name', client)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
}
