export default function handler(req, res) {
  const type = req.query.type || 'gsc';

  const scopeMap = {
    ga4: 'https://www.googleapis.com/auth/analytics.readonly',
    gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  };
  const scope = scopeMap[type] || 'https://www.googleapis.com/auth/webmasters.readonly';

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state: type,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
