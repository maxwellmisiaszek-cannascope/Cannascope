// api/send-quiz-sms.js
// Vercel serverless function — sends quiz result SMS via Twilio
//
// REQUIRED ENV VARS (set in Vercel → Project → Settings → Environment Variables):
//   TWILIO_ACCOUNT_SID    — your Twilio Account SID
//   TWILIO_AUTH_TOKEN     — your Twilio Auth Token
//   TWILIO_FROM_NUMBER    — your Twilio phone number (e.g. +13235551234)
//                           or Messaging Service SID (recommended for cannabis SMS)
//
// IMPORTANT — TCPA / cannabis SMS notes:
//   1. Caller MUST verify the user explicitly opted in to SMS before this is hit.
//      Frontend already enforces this (checkbox required).
//   2. The first message must contain opt-out instructions ("Reply STOP to opt out").
//   3. Cannabis SMS often gets carrier-filtered. Use a registered 10DLC campaign
//      with a Messaging Service SID for higher delivery rates.

const ARCHETYPE_LABELS = {
  sleeper:   'The Deep Sleeper',
  unwinder:  'The Unwinder',
  sharpener: 'The Sharpener',
  social:    'The Social Spark',
  healer:    'The Healer',
  explorer:  'The Explorer',
  microdose: 'The Micro-Doser',
};

const ARCHETYPE_ASKS = {
  sleeper:   'indica high in myrcene — Granddaddy Purple, Northern Lights, or Purple Punch',
  unwinder:  'indica-leaning hybrid — Blue Dream, Wedding Cake, or Gelato',
  sharpener: 'sativa high in limonene/pinene — Jack Herer, Sour Diesel, or Green Crack',
  social:    'uplifting sativa or bright hybrid — Pineapple Express or Strawberry Cough',
  healer:    'CBD-forward (1:1 or higher) — ACDC, Harlequin, or Cannatonic',
  explorer:  'low-dose or CBD-forward — start at 2.5mg THC and wait 2 hours',
  microdose: 'a microdose — 2.5mg THC gummy, or one small puff and wait',
};

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function buildSmsBody({ archetype, name, cardId }) {
  const label = ARCHETYPE_LABELS[archetype] || 'Your Cannascope';
  const ask   = ARCHETYPE_ASKS[archetype]   || 'something matched to your goal';
  const greet = name ? `Hey ${name}! ` : '';
  return `${greet}Your Cannascope: ${label}.

Ask your budtender for ${ask}.

Card ID: ${cardId || 'CS-—'}
Retake: whatshouldigetatthedispensary.com

Reply STOP to unsubscribe.`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { phone, name, archetype, cardId } = req.body || {};
  if (!phone || !archetype) return res.status(400).json({ error: 'Missing phone or archetype' });

  const to = normalizePhone(phone);
  if (!to) return res.status(400).json({ error: 'Invalid phone number' });

  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_FROM_NUMBER;

  if (!SID || !TOKEN || !FROM) {
    return res.status(500).json({ error: 'SMS service not configured' });
  }

  const body = buildSmsBody({ archetype, name, cardId });

  // Twilio REST — Messaging API
  // If FROM starts with "MG" treat it as a Messaging Service SID, else as a from number.
  const params = new URLSearchParams();
  params.append('To', to);
  if (FROM.startsWith('MG')) params.append('MessagingServiceSid', FROM);
  else                       params.append('From', FROM);
  params.append('Body', body);

  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[send-quiz-sms] Twilio error:', data);
      return res.status(502).json({ error: 'SMS delivery failed', detail: data });
    }
    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (e) {
    console.error('[send-quiz-sms] Exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
