// api/admin-stats.js
// Vercel serverless function — returns aggregated stats from Supabase.
// Gated by ADMIN_PASSPHRASE env var. Uses SUPABASE_SERVICE_ROLE_KEY so
// the demand_events table can stay locked down for the public anon key.
//
// REQUIRED ENV VARS (set in Vercel → Project → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  — service role key from Supabase project settings
//   ADMIN_PASSPHRASE           — your secret passphrase for the admin dashboard

const SUPABASE_URL = 'https://nrcvpwyvxmplwvjrdoua.supabase.co';
const ORG_ID       = 'c78449ac-deee-4ad3-83dd-6633ee187063';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pass');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const pass = req.headers['x-admin-pass'] || (req.body && req.body.pass);
  const expected = process.env.ADMIN_PASSPHRASE;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSPHRASE not configured on server' });
  if (!pass || pass !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SR_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  try {
    const url = `${SUPABASE_URL}/rest/v1/demand_events?organization_id=eq.${ORG_ID}&order=created_at.desc&limit=5000`;
    const r = await fetch(url, {
      headers: {
        'apikey':        SR_KEY,
        'Authorization': `Bearer ${SR_KEY}`,
      },
    });
    const events = await r.json();
    if (!Array.isArray(events)) {
      return res.status(500).json({ error: 'Bad response from DB', detail: events });
    }

    const summary = {
      total_events:      events.length,
      total_quizzes:     0,
      email_captures:    0,
      sms_captures:      0,
      save_image_events: 0,
      first_event:       null,
      last_event:        null,
    };
    const byDay        = {};
    const byArchetype  = {};
    const byGoal       = {};
    const byFormat     = {};
    const byExperience = {};
    const byIntensity  = {};
    const zipCounts    = {};
    const recent       = [];
    const sessions     = new Set();

    for (const e of events) {
      const ts = e.created_at;
      sessions.add(e.session_id);

      let meta = {};
      try {
        meta = typeof e.experience === 'string' ? JSON.parse(e.experience) : (e.experience || {});
      } catch(_) {}

      if (e.event_type === 'quiz_complete') summary.total_quizzes++;
      if (e.event_type === 'email_capture') summary.email_captures++;
      if (e.event_type === 'sms_capture')   summary.sms_captures++;
      if (e.event_type === 'save_image')    summary.save_image_events++;

      if (!summary.first_event || ts < summary.first_event) summary.first_event = ts;
      if (!summary.last_event  || ts > summary.last_event)  summary.last_event  = ts;

      const day = (ts || '').slice(0, 10);
      if (day) {
        byDay[day] = byDay[day] || { quizzes: 0, captures: 0 };
        if (e.event_type === 'quiz_complete') byDay[day].quizzes++;
        if (e.event_type === 'email_capture' || e.event_type === 'sms_capture') byDay[day].captures++;
      }

      if (e.event_type === 'quiz_complete') {
        if (meta.archetype)  byArchetype[meta.archetype]   = (byArchetype[meta.archetype]   || 0) + 1;
        if (meta.goal)       byGoal[meta.goal]             = (byGoal[meta.goal]             || 0) + 1;
        if (meta.format)     byFormat[meta.format]         = (byFormat[meta.format]         || 0) + 1;
        if (meta.experience) byExperience[meta.experience] = (byExperience[meta.experience] || 0) + 1;
        if (meta.intensity)  byIntensity[meta.intensity]   = (byIntensity[meta.intensity]   || 0) + 1;
      }

      if (meta.zip && /^\d{5}$/.test(meta.zip)) {
        zipCounts[meta.zip] = (zipCounts[meta.zip] || 0) + 1;
      }

      if (recent.length < 50) {
        recent.push({
          ts,
          event:     e.event_type,
          archetype: meta.archetype || null,
          goal:      meta.goal      || null,
          format:    meta.format    || null,
          zip:       meta.zip       || null,
          name:      meta.name      || null,
        });
      }
    }

    summary.unique_sessions   = sessions.size;
    summary.sms_opt_in_rate   = summary.total_quizzes ? summary.sms_captures / summary.total_quizzes : 0;
    summary.email_capture_rate= summary.total_quizzes ? summary.email_captures / summary.total_quizzes : 0;

    // Build a continuous last-30-days series (fill missing days with zeros)
    const now = new Date();
    const dayList = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const k = d.toISOString().slice(0,10);
      dayList.push({
        date:     k,
        quizzes:  byDay[k]?.quizzes  || 0,
        captures: byDay[k]?.captures || 0,
      });
    }

    const topZips = Object.entries(zipCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 10)
      .map(([zip, count]) => ({ zip, count }));

    return res.status(200).json({
      ok:             true,
      generated_at:   new Date().toISOString(),
      summary,
      by_day:         dayList,
      by_archetype:   byArchetype,
      by_goal:        byGoal,
      by_format:      byFormat,
      by_experience:  byExperience,
      by_intensity:   byIntensity,
      top_zips:       topZips,
      recent,
    });
  } catch(e) {
    console.error('[admin-stats] error:', e);
    return res.status(500).json({ error: e.message });
  }
};
