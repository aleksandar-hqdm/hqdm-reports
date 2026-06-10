// Shared, persistent state for cancelled strategy tasks, so a Cancel is visible
// to everyone who opens the link, not just the person who clicked it.
//
// Backed by Vercel Blob: one tiny file per cancelled task at cancels/<slug>/<key>
// (its existence = cancelled). This is race-free: cancel = create the file,
// revert = delete it, no read-modify-write. GET ?slug=<account> lists the
// cancelled keys; POST {slug, task, cancelled} creates or removes one. If the
// store token is missing it degrades to empty (cancels stay local-only, nothing
// breaks). The store is Private, so reads/writes go through the token only.
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
const API = 'https://blob.vercel-storage.com';
const VER = '7';

function safe(s) { return String(s == null ? '' : s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80); }

async function blobList(prefix) {
  const r = await fetch(API + '/?prefix=' + encodeURIComponent(prefix) + '&limit=1000', {
    headers: { authorization: 'Bearer ' + TOKEN, 'x-api-version': VER }
  });
  if (!r.ok) throw new Error('list ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}

async function blobPut(pathname) {
  const r = await fetch(API + '/' + pathname, {
    method: 'PUT',
    headers: {
      authorization: 'Bearer ' + TOKEN,
      'x-api-version': VER,
      'x-content-type': 'text/plain',
      'x-add-random-suffix': '0',
      'x-allow-overwrite': '1',
      'x-vercel-blob-access': 'private'
    },
    body: '1'
  });
  if (!r.ok) throw new Error('put ' + r.status + ' ' + (await r.text()).slice(0, 160));
  return r.json();
}

async function blobDel(urls) {
  if (!urls.length) return;
  const r = await fetch(API + '/delete', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + TOKEN, 'x-api-version': VER, 'content-type': 'application/json' },
    body: JSON.stringify({ urls: urls })
  });
  if (!r.ok) throw new Error('del ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!TOKEN) {
    res.status(200).json({ ok: false, cancelled: [], error: 'not_configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const slug = safe(req.query && req.query.slug);
      if (!slug) { res.status(400).json({ ok: false, cancelled: [] }); return; }
      const data = await blobList('cancels/' + slug + '/');
      const cancelled = (data.blobs || []).map(function (b) { return b.pathname.split('/').pop(); });
      res.status(200).json({ ok: true, cancelled: cancelled });
      return;
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      b = b || {};
      const slug = safe(b.slug), task = safe(b.task);
      if (!slug || !task) { res.status(400).json({ ok: false }); return; }
      const path = 'cancels/' + slug + '/' + task;
      if (b.cancelled) {
        await blobPut(path);
      } else {
        const data = await blobList('cancels/' + slug + '/');
        const urls = (data.blobs || []).filter(function (x) { return x.pathname === path; }).map(function (x) { return x.url; });
        await blobDel(urls);
      }
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
