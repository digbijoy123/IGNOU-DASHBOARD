export default function handler(req, res) {
  // Set cache headers so clients always fetch fresh configuration
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  let rawUrl = process.env.SUPABASE_URL || '';
  const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    return res.status(500).json({
      error: 'Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are not configured in Vercel settings.',
      url: null,
      anonKey: null
    });
  }

  return res.status(200).json({
    url,
    anonKey
  });
}
