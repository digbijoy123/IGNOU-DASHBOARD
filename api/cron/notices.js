// Disable strict SSL verification for Indian gov portals with expired/self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { createClient } from '@supabase/supabase-js';

const COURSES = ['BCS111', 'BCS12', 'BCSL13', 'BEGLA136', 'BEVAE181', 'BCA'];
const KEYWORDS = ['assignment', 'examination', 'tee', 'practical', 'counselling', 'hall ticket', 'admit card', 'date sheet', 're-registration', 'bca', 'schedule'];

function extractMatches(text) {
  const matched = [];
  const lower = (text || '').toLowerCase();
  for (const c of COURSES) {
    if (lower.includes(c.toLowerCase()) || lower.includes(c.toLowerCase().replace(/(\d+)/, '-$1'))) {
      matched.push(c);
    }
  }
  return matched;
}

export default async function handler(req, res) {
  // Verify authorization for Vercel Cron
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
    }
  }

  const rawUrl = process.env.SUPABASE_URL || '';
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const collected = [];

  // 1. Fetch IGNOU HQ Announcements
  try {
    const resp = await fetch('https://www.ignou.ac.in/announcements/0', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000)
    });
    if (resp.ok) {
      const html = await resp.text();
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const link = match[1];
        const rawTitle = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (rawTitle.length > 10 && rawTitle.length < 250) {
          const lower = rawTitle.toLowerCase();
          const hasKeyword = KEYWORDS.some(k => lower.includes(k));
          if (hasKeyword) {
            const fullUrl = link.startsWith('http') ? link : `https://www.ignou.ac.in${link.startsWith('/') ? '' : '/'}${link}`;
            collected.push({
              title: rawTitle,
              source: 'IGNOU HQ Announcements',
              url: fullUrl,
              matched_courses: extractMatches(rawTitle),
              detected_at: new Date().toISOString()
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch IGNOU announcements:', err.message);
  }

  // 2. Fetch RC Guwahati Announcements and Counselling
  const rcEndpoints = [
    { url: 'http://rcguwahati.ignou.ac.in/', source: 'RC Guwahati Home' },
    { url: 'http://rcguwahati.ignou.ac.in/studentcorner/9', source: 'RC Guwahati Counselling' }
  ];

  for (const ep of rcEndpoints) {
    try {
      const resp = await fetch(ep.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(8000)
      });
      if (resp.ok) {
        const html = await resp.text();
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const link = match[1];
          const rawTitle = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          if (rawTitle.length > 10 && rawTitle.length < 250) {
            const lower = rawTitle.toLowerCase();
            const hasKeyword = KEYWORDS.some(k => lower.includes(k));
            if (hasKeyword) {
              const fullUrl = link.startsWith('http') ? link : `http://rcguwahati.ignou.ac.in${link.startsWith('/') ? '' : '/'}${link}`;
              collected.push({
                title: rawTitle,
                source: ep.source,
                url: fullUrl,
                matched_courses: extractMatches(rawTitle),
                detected_at: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${ep.source}:`, err.message);
    }
  }

  // Upsert deduplicated notifications into Supabase
  let insertedCount = 0;
  const uniqueItems = new Map();
  for (const item of collected) {
    if (!uniqueItems.has(item.url)) {
      uniqueItems.set(item.url, item);
    }
  }

  const itemsToInsert = Array.from(uniqueItems.values());
  if (itemsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('notifications')
      .upsert(itemsToInsert, { onConflict: 'url,title', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(500).json({ error: error.message, collectedCount: itemsToInsert.length });
    }
    insertedCount = data?.length || 0;
  }

  return res.status(200).json({
    success: true,
    collectedCount: itemsToInsert.length,
    insertedCount,
    timestamp: new Date().toISOString()
  });
}
