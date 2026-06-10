// Shared, persistent state for cancelled strategy tasks, so a Cancel is visible
// to everyone who opens the link, not just the person who clicked it.
// Backed by Upstash Redis (Vercel KV). GET ?slug=<account> returns the cancelled
// task keys; POST {slug, task, cancelled} adds or removes one. If the store is
// not configured it degrades to empty (cancels stay local-only, nothing breaks).
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

function safe(s) { return String(s == null ? '' : s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); }

async function redis(command) {
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const j = await r.json();
  return j.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REST_URL || !REST_TOKEN) {
    res.status(200).json({ ok: false, cancelled: [], error: 'not_configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const slug = safe(req.query && req.query.slug);
      if (!slug) { res.status(400).json({ ok: false, cancelled: [] }); return; }
      const members = await redis(['SMEMBERS', 'cancel_' + slug]);
      res.status(200).json({ ok: true, cancelled: members || [] });
      return;
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      const slug = safe(b.slug), task = safe(b.task);
      if (!slug || !task) { res.status(400).json({ ok: false }); return; }
      await redis([b.cancelled ? 'SADD' : 'SREM', 'cancel_' + slug, task]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
