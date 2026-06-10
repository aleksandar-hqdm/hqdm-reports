// Vercel serverless relay for the strategy QA actions (Issue + Request).
// Holds the Slack webhook in an env var so it is never exposed in the public
// static files. Set SLACK_WEBHOOK_URL in the Vercel project settings.
//
// Slack setup: create an Incoming Webhook (or a Slack Workflow with a webhook
// trigger) pointing at the channel or DM you want notifications in, copy the
// URL, and add it in Vercel as SLACK_WEBHOOK_URL. Redeploy and it is live.
// This runs on the Vercel deployment only, not on GitHub Pages.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (!hook) {
    res.status(503).json({ ok: false, error: 'not_configured' });
    return;
  }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b || {};
    const v = (s) => String(s == null ? '' : s).slice(0, 2000);

    let text;
    if (b.type === 'issue') {
      text = ':warning: *Strategy task issue*\n' +
        '*From:* ' + v(b.person) + '\n' +
        '*Client:* ' + v(b.client) + '\n' +
        '*Task:* ' + v(b.taskTitle) + '\n' +
        '*Comment:* ' + v(b.comment);
    } else if (b.type === 'request') {
      text = ':speech_balloon: *Request*\n' +
        '*From:* ' + v(b.person) + '\n' +
        '*Client:* ' + v(b.client) + '\n' +
        '*Message:* ' + v(b.message);
    } else {
      text = ':bell: Notification\n' + v(JSON.stringify(b));
    }

    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
