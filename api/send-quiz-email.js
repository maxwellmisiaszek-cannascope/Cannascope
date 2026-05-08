// api/send-quiz-email.js
// Vercel serverless function — sends quiz result emails via Resend

const ARCHETYPES = {
  sleeper: {
    label: 'The Deep Sleeper',
    headline: 'Your body already knows how to rest. Cannabis just reminds it.',
    category: 'Heavy indica — sedating, body-focused, built for sleep',
    strains: ['Granddaddy Purple', 'Northern Lights', 'Purple Punch', 'Do-Si-Dos', 'Zkittlez'],
    productsByFormat: {
      flower:   [
        { name: 'Indica flower', detail: 'Ask for anything heavy or labeled "nighttime"' },
        { name: 'Granddaddy Purple / Northern Lights', detail: 'If they carry it — grab it' },
        { name: 'Indica pre-roll', detail: 'Classic, immediate, grab a couple' },
      ],
      vape:     [
        { name: 'Indica vape cartridge', detail: 'Look for "nighttime" or "sleep" on the label' },
        { name: 'Live resin indica cart', detail: 'Fuller, more complete effect than distillate' },
        { name: 'Disposable indica vape', detail: 'No setup — ready to go' },
      ],
      edible:   [
        { name: '10mg "nighttime" THC gummy', detail: 'Take it 90 minutes before bed' },
        { name: 'CBN + THC sleep edible', detail: 'Most sleep formulas add CBN — look for it' },
        { name: 'Higher-dose indica edible', detail: '10–25mg if your tolerance is established' },
      ],
      tincture: [
        { name: 'CBN + THC sleep tincture', detail: 'Sublingual — faster than edibles' },
        { name: 'High-dose indica capsule', detail: 'Precise dose, long-lasting effect' },
        { name: '1:1 THC:CBD tincture with CBN', detail: 'The full sleep stack' },
      ],
      any:      [
        { name: '10mg indica gummy or "nighttime" formula', detail: 'Easiest, most consistent starting point' },
        { name: 'Indica flower or pre-roll', detail: 'Ask for anything heavy and myrcene-dominant' },
        { name: 'Indica vape cartridge', detail: 'For quick dosing right before bed' },
      ],
    },
    terpenes: ['Myrcene', 'Linalool', 'Caryophyllene'],
    terpene_note: 'Myrcene is the compound most directly associated with sedation — it\'s what makes a strain feel heavy. Linalool adds the calming effect without sedation on its own.',
    tip: 'Tell your budtender you want something high in myrcene. That one word gets you exactly what you need — they\'ll know immediately.',
    tagline: 'Built for sleep.',
  },
  unwinder: {
    label: 'The Unwinder',
    headline: 'Not shut down. Just turned down.',
    category: 'Indica-leaning hybrid — decompress without checking out',
    strains: ['Blue Dream', 'Wedding Cake', 'Gelato', 'Banana Kush', 'Runtz'],
    productsByFormat: {
      flower:   [
        { name: 'Indica-leaning hybrid flower', detail: 'Blue Dream, Gelato, or Wedding Cake' },
        { name: 'Hybrid pre-roll', detail: 'Not too heavy, not too energizing — right in the middle' },
        { name: 'Any "relaxing" or "evening" hybrid', detail: 'Ask the budtender what they reach for' },
      ],
      vape:     [
        { name: 'Hybrid or indica-leaning vape cart', detail: 'Look for "relaxing" or "balanced" on the label' },
        { name: 'Live resin hybrid cart', detail: 'Smoother, more nuanced effect than distillate' },
        { name: 'Disposable indica-hybrid vape', detail: 'Easy to control and put away' },
      ],
      edible:   [
        { name: '5–10mg hybrid gummy', detail: 'Noticeable but you\'re still in control' },
        { name: 'Indica-leaning low-dose edible', detail: '5mg is a solid starting point for evenings' },
        { name: '"Evening" or "relax" formula gummy', detail: 'If they carry one — usually a good blend' },
      ],
      tincture: [
        { name: '1:1 THC:CBD tincture', detail: 'The most adjustable, forgiving option' },
        { name: 'Low-dose indica tincture or capsule', detail: 'Start at half a dropper' },
        { name: 'Balanced blend tincture', detail: 'Look for equal THC and CBD on the label' },
      ],
      any:      [
        { name: '5–10mg hybrid gummy', detail: 'Felt but controlled — easy to gauge' },
        { name: 'Indica-leaning hybrid vape cart', detail: 'Put it down the moment you feel right' },
        { name: 'Hybrid flower or pre-roll', detail: 'Blue Dream or Gelato are both great here' },
      ],
    },
    terpenes: ['Myrcene', 'Caryophyllene', 'Linalool'],
    terpene_note: 'Caryophyllene reduces tension without sedation. It\'s the terpene that takes the edge off without putting you on the couch.',
    tip: 'Ask for an indica-leaning hybrid — not full indica. You want to decompress, not disappear. That one distinction makes a real difference.',
    tagline: 'Relax. Don\'t check out.',
  },
  sharpener: {
    label: 'The Sharpener',
    headline: 'Clarity isn\'t a side effect. It\'s the whole point.',
    category: 'Sativa — uplifting, clear-headed, good for creative work',
    strains: ['Jack Herer', 'Sour Diesel', 'Green Crack', 'Durban Poison', 'Trainwreck'],
    productsByFormat: {
      flower:   [
        { name: 'Sativa flower', detail: 'Jack Herer, Sour Diesel, or Green Crack' },
        { name: 'Sativa pre-roll', detail: 'Great for a creative session — classic format' },
        { name: 'Any "energizing" or "daytime" sativa', detail: 'Ask what budtenders reach for at 10am' },
      ],
      vape:     [
        { name: 'Sativa vape cartridge', detail: 'Fast, clean, easy to put down' },
        { name: 'Limonene-dominant live resin cart', detail: 'Ask for it — brighter and more expressive' },
        { name: 'Sativa disposable vape', detail: 'Controlled and consistent' },
      ],
      edible:   [
        { name: '2.5mg microdose THC gummy', detail: 'Sub-perceptual lift — no buzz, just clarity' },
        { name: '5mg sativa edible max', detail: 'Higher and you risk losing the focus' },
        { name: 'Microdose capsule', detail: 'If they have a dedicated low-dose line — grab it' },
      ],
      tincture: [
        { name: '2.5–5mg microdose THC capsule', detail: 'Precise — same effect every single time' },
        { name: '4:1 THC:CBD low-dose tincture', detail: 'Functional and calm' },
        { name: 'Sublingual sativa tincture', detail: 'Fast onset, easy to control' },
      ],
      any:      [
        { name: 'Sativa flower or pre-roll', detail: 'The most reliable option for focus and creativity' },
        { name: 'Sativa vape cartridge', detail: 'Fast and easy to dial in exactly' },
        { name: '2.5mg microdose gummy', detail: 'For daytime use where clarity matters' },
      ],
    },
    terpenes: ['Limonene', 'Pinene', 'Terpinolene'],
    terpene_note: 'Limonene and pinene are associated with elevated mood and mental clarity. They\'re the exact opposite of the "couch lock" stereotype.',
    tip: 'Ask for something high in limonene or pinene, and tell them you want daytime. Avoid anything labeled heavy indica — that\'s working against you.',
    tagline: 'Think better.',
  },
  social: {
    label: 'The Social Spark',
    headline: 'Present. Warm. Actually enjoying yourself.',
    category: 'Uplifting sativa or hybrid — good energy, relaxed nerves',
    strains: ['Pineapple Express', 'Strawberry Cough', 'Super Lemon Haze', 'Blue Dream', 'Cherry Pie'],
    productsByFormat: {
      flower:   [
        { name: 'Uplifting sativa pre-roll', detail: 'Strawberry Cough or Pineapple Express — easy to share' },
        { name: 'Bright sativa or hybrid flower', detail: 'Ask for something "happy" or "social"' },
        { name: 'Pre-roll pack', detail: 'Shareable — good for groups' },
      ],
      vape:     [
        { name: 'Sativa vape cartridge', detail: 'Control the dose in real time — easy to stop' },
        { name: 'Uplifting live resin sativa cart', detail: 'Brighter and more expressive effect' },
        { name: 'Disposable sativa vape', detail: 'Discreet, easy to put in your pocket' },
      ],
      edible:   [
        { name: '2.5–5mg sativa gummy', detail: 'Gives you a ceiling — nearly impossible to overdo' },
        { name: 'Low-dose sativa or hybrid edible', detail: 'Start at 5mg and see where you land' },
        { name: '"Happy" or "social" formula gummy', detail: 'If they carry one — usually nailed it' },
      ],
      tincture: [
        { name: '2.5mg microdose capsule', detail: 'Functional, clean — no ceiling anxiety' },
        { name: 'Low-dose sativa tincture', detail: 'Sublingual — hits faster than edibles' },
        { name: '4:1 THC:CBD tincture', detail: 'Social without being sloppy' },
      ],
      any:      [
        { name: '2.5–5mg sativa gummy', detail: 'Ceiling effect — nothing gets out of hand' },
        { name: 'Sativa vape cart', detail: 'Titrate in real time, easy to stop' },
        { name: 'Sativa or hybrid pre-roll', detail: 'Classic, shareable, easy' },
      ],
    },
    terpenes: ['Limonene', 'Terpinolene', 'Pinene'],
    terpene_note: 'Limonene is directly linked to elevated mood and reduced anxiety — exactly what you want when you\'re trying to be present with people.',
    tip: 'Ask for uplifting and not sedating — a sativa or bright hybrid. A low-dose edible gives you a ceiling. A vape lets you go slowly. Either works. Just avoid anything heavy.',
    tagline: 'Show up as yourself.',
  },
  healer: {
    label: 'The Healer',
    headline: 'This isn\'t about getting high. It\'s about feeling better.',
    category: 'CBD-forward — therapeutic relief without losing your day',
    strains: ['ACDC', 'Harlequin', 'Cannatonic', 'Ringo\'s Gift', 'Charlotte\'s Web'],
    productsByFormat: {
      flower:   [
        { name: 'High-CBD flower', detail: 'ACDC, Harlequin, or Cannatonic — minimal psychoactive effect' },
        { name: '1:1 CBD:THC pre-roll', detail: 'Mild, therapeutic, balanced' },
        { name: 'CBD-dominant flower', detail: 'Ask for the highest CBD:THC ratio they carry' },
      ],
      vape:     [
        { name: 'High-CBD or 1:1 vape cartridge', detail: 'Fast-acting, targeted relief' },
        { name: 'CBD-dominant vape', detail: 'ACDC or Harlequin oil — minimal psychoactive effect' },
        { name: '1:1 live resin cart', detail: 'Balanced and therapeutic' },
      ],
      edible:   [
        { name: '1:1 CBD:THC gummy', detail: 'Systemic, long-lasting — good for body tension' },
        { name: 'High-CBD gummy (20:1 ratio)', detail: 'Zero high — if they carry it, grab it' },
        { name: '"Rest" or "relief" formula edible', detail: 'Usually CBD-forward — works well' },
      ],
      tincture: [
        { name: 'CBD topical', detail: 'Apply directly to where it hurts — zero high, localized' },
        { name: '1:1 sublingual tincture', detail: 'Faster onset than edibles, easy to dose' },
        { name: 'High-CBD tincture (20:1+)', detail: 'Therapeutic without any intoxication' },
      ],
      any:      [
        { name: '1:1 CBD:THC gummy', detail: 'Most accessible therapeutic option — widely available' },
        { name: 'High-CBD vape cartridge', detail: 'Fast relief when you need it' },
        { name: 'CBD topical for localized pain', detail: 'Goes right to the source — no high at all' },
      ],
    },
    terpenes: ['Caryophyllene', 'Myrcene', 'Linalool'],
    terpene_note: 'Caryophyllene is the only terpene that binds directly to CB2 receptors — the ones involved in pain and inflammation. Zero psychoactive effect on its own.',
    tip: 'Ask your budtender for something high in caryophyllene. That phrase alone tells them what you need. They\'ll take it seriously because it is serious.',
    tagline: 'Targeted relief.',
  },
  explorer: {
    label: 'The Explorer',
    headline: 'Everyone starts somewhere. This is a good place.',
    category: 'Gentle intro — low-dose or CBD-forward',
    strains: ['Harlequin', 'ACDC', 'Blue Dream (low dose)', 'Pennywise'],
    productsByFormat: {
      flower:   [
        { name: 'CBD-rich pre-roll', detail: 'Very low or zero THC — nothing overwhelming' },
        { name: '1:1 pre-roll', detail: 'A mild, gentle introduction to flower' },
        { name: 'CBD-dominant flower', detail: 'Ask for the highest CBD and lowest THC they have' },
      ],
      vape:     [
        { name: 'CBD-dominant vape', detail: 'Calming, with only trace THC' },
        { name: '1:1 cart', detail: 'One small puff — wait 10 full minutes before another' },
        { name: 'CBD disposable vape', detail: 'Easy to control, total peace of mind' },
      ],
      edible:   [
        { name: '2.5mg THC gummy', detail: 'The universal starting point at every dispensary' },
        { name: 'CBD gummy (zero THC)', detail: 'If you want absolutely no psychoactive effect' },
        { name: '1:1 low-dose gummy', detail: 'The mildest THC introduction — 5mg total' },
      ],
      tincture: [
        { name: 'CBD tincture', detail: 'Zero THC — easy to measure, easy to adjust' },
        { name: '2.5mg microdose capsule', detail: 'Precise, forgiving, beginner-proof' },
        { name: '1:1 low-dose tincture', detail: 'Start at half a dropper and wait an hour' },
      ],
      any:      [
        { name: '2.5mg THC gummy', detail: 'The safest, most controlled starting point' },
        { name: 'CBD pre-roll or CBD vape', detail: 'If you\'re not ready for THC yet — this is it' },
        { name: 'Tell your budtender it\'s your first time', detail: 'They\'re genuinely good at this — let them guide you' },
      ],
    },
    terpenes: ['Linalool', 'Myrcene'],
    terpene_note: 'Linalool is calming and grounding — same compound that makes lavender work. It takes the anxiety out of the experience.',
    tip: 'Tell your budtender this is new territory. They\'ve heard it a thousand times and they\'re good at this. Start at 2.5mg. Wait two full hours before deciding you need more.',
    tagline: 'A gentle start.',
  },
  microdose: {
    label: 'The Micro-Doser',
    headline: 'Less is a philosophy, not a compromise.',
    category: 'Sub-perceptual THC — the effect without the high',
    strains: ['ACDC', 'Harlequin', 'Any strain — at 2.5mg dose'],
    productsByFormat: {
      flower:   [
        { name: 'High-CBD flower', detail: 'Stay functional and clear-headed all day' },
        { name: 'CBD pre-roll', detail: 'Calming without any real intoxication' },
        { name: 'Low-THC hybrid flower', detail: 'One or two hits — then put it down' },
      ],
      vape:     [
        { name: 'One small puff from a sativa or hybrid cart', detail: 'Then wait 15 minutes before deciding' },
        { name: 'CBD-forward vape with trace THC', detail: 'Steady and functional' },
        { name: 'Low-THC disposable', detail: 'Easy to moderate, easy to stop' },
      ],
      edible:   [
        { name: '2.5mg microdose THC gummy', detail: 'Gold standard for precision — same effect every time' },
        { name: 'Microdose capsule (2.5mg)', detail: 'Exactly repeatable — ideal for daily use' },
        { name: 'CBD gummy', detail: 'Full therapeutic benefit with zero high' },
      ],
      tincture: [
        { name: '1:1 tincture', detail: 'Start at half a dropper — add slowly over 30 minutes' },
        { name: 'CBD tincture', detail: 'Zero psychoactive effect with full therapeutic value' },
        { name: 'Low-dose THC sublingual', detail: 'Measure carefully — give it 30 minutes' },
      ],
      any:      [
        { name: '2.5mg microdose gummy', detail: 'Precise, gentle, repeatable' },
        { name: 'CBD-dominant vape', detail: 'One puff at a time — total control' },
        { name: 'Say "microdose" to your budtender', detail: 'They\'ll know exactly where to go' },
      ],
    },
    terpenes: ['Varies by goal'],
    terpene_note: 'At microdose levels, terpenes matter more than THC percentage. The entourage effect is what you\'re after — not the high.',
    tip: 'Say "microdose" to your budtender. That word alone tells them everything. Most dispensaries carry a dedicated low-dose line — they\'ll walk you right to it.',
    tagline: 'Precision over intensity.',
  },
};

function buildEmailHtml(arch, answers) {
  const a = ARCHETYPES[arch];
  if (!a) return null;

  const goalLabel = {
    sleep: 'Better sleep', relax: 'Relaxation', focus: 'Focus & creativity',
    social: 'Social ease', relief: 'Pain & tension relief', beginner: 'Just exploring',
  }[answers.goal] || answers.goal || 'Your goal';

  const formatLabel = {
    edible: 'Edibles', vape: 'Vape', flower: 'Flower',
    tincture: 'Tincture / Capsule', any: 'Open to anything',
  }[answers.format] || '';

  const expLabel = {
    new: 'First time', casual: 'Tried it a few times',
    regular: 'Regular user', daily: 'Daily',
  }[answers.experience] || '';

  // Pick format-appropriate products
  const fmt = (answers.format && a.productsByFormat[answers.format]) ? answers.format : 'any';
  const products = a.productsByFormat[fmt];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Cannascope — ${a.label}</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F0;-webkit-font-smoothing:antialiased;">

<!-- WRAPPER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5F0;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px 60px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <!-- ═══ HERO ═══ -->
  <tr><td style="background:#1B4332;border-radius:20px 20px 0 0;padding:44px 40px 40px;text-align:center;">
    <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#52B788;margin-bottom:28px;">Cannascope · Your Recommendation</div>
    <div style="font-size:13px;color:#A7C4B5;letter-spacing:0.04em;text-transform:uppercase;font-weight:500;margin-bottom:10px;">You are</div>
    <div style="font-size:42px;font-weight:700;color:#FFFFFF;letter-spacing:-0.03em;line-height:1.1;margin-bottom:14px;font-family:Georgia,'Times New Roman',serif;">${a.label}</div>
    <div style="width:40px;height:2px;background:#52B788;margin:0 auto 18px;"></div>
    <div style="font-size:17px;color:#C8DDD6;line-height:1.55;font-style:italic;font-family:Georgia,'Times New Roman',serif;font-weight:400;">${a.headline}</div>
  </td></tr>

  <!-- ═══ YOUR PROFILE STRIP ═══ -->
  <tr><td style="background:#2D6A4F;padding:0 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      ${goalLabel ? `<td width="33%" style="padding:14px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#74C69D;font-weight:700;margin-bottom:3px;">Goal</div>
        <div style="font-size:12px;color:#FFFFFF;font-weight:600;">${goalLabel}</div>
      </td>` : '<td></td>'}
      ${expLabel ? `<td width="33%" style="padding:14px 0;text-align:center;border-right:1px solid rgba(255,255,255,0.1);">
        <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#74C69D;font-weight:700;margin-bottom:3px;">Experience</div>
        <div style="font-size:12px;color:#FFFFFF;font-weight:600;">${expLabel}</div>
      </td>` : '<td></td>'}
      ${formatLabel ? `<td width="33%" style="padding:14px 0;text-align:center;">
        <div style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#74C69D;font-weight:700;margin-bottom:3px;">Format</div>
        <div style="font-size:12px;color:#FFFFFF;font-weight:600;">${formatLabel}</div>
      </td>` : '<td></td>'}
    </tr>
    </table>
  </td></tr>

  <!-- ═══ MAIN CARD ═══ -->
  <tr><td style="background:#FFFFFF;padding:36px 40px;">

    <!-- What to get -->
    <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#2D6A4F;margin-bottom:14px;">What to ask for</div>
    <div style="font-size:14px;color:#3D3D30;line-height:1.6;margin-bottom:24px;font-weight:500;">${a.category}</div>

    <!-- Strains -->
    <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9A9A82;margin-bottom:10px;">Strains that work</div>
    <div style="margin-bottom:24px;">
      ${a.strains.map((s, i) => `<span style="display:inline-block;background:${i === 0 ? '#1B4332' : '#EFF7F3'};color:${i === 0 ? '#FFFFFF' : '#2D6A4F'};font-size:12px;font-weight:600;padding:6px 14px;border-radius:100px;margin:0 5px 7px 0;letter-spacing:0.01em;">${s}</span>`).join('')}
    </div>

    <!-- Products -->
    <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9A9A82;margin-bottom:12px;">Products to look for</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      ${products.map((p, i) => `
      <tr>
        <td style="padding:10px 14px;background:${i % 2 === 0 ? '#F9F9F7' : '#FFFFFF'};border-radius:8px;margin-bottom:4px;">
          <div style="font-size:13px;font-weight:600;color:#1C1C16;margin-bottom:2px;">${p.name}</div>
          <div style="font-size:12px;color:#8A8D84;">${p.detail}</div>
        </td>
      </tr>
      <tr><td style="height:4px;"></td></tr>`).join('')}
    </table>

    <!-- Divider -->
    <div style="border-top:1px solid #EBEBEB;margin:4px 0 24px;"></div>

    <!-- Terpenes -->
    <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9A9A82;margin-bottom:10px;">The science behind it</div>
    <div style="font-size:13px;color:#5A5A48;line-height:1.7;margin-bottom:12px;">${a.terpene_note}</div>
    <div style="margin-bottom:28px;">
      ${a.terpenes.map(t => `<span style="display:inline-block;background:#F7F5F0;color:#3D3D30;font-size:11px;font-weight:600;padding:5px 12px;border-radius:100px;margin:0 5px 6px 0;border:1px solid #E0DDD5;letter-spacing:0.02em;">${t}</span>`).join('')}
    </div>

    <!-- Tip -->
    <div style="background:#F0F7F3;border-radius:12px;padding:20px 22px;border-left:4px solid #52B788;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#40916C;margin-bottom:8px;">Your budtender script</div>
      <div style="font-size:14px;color:#1C1C16;line-height:1.65;font-style:italic;font-family:Georgia,'Times New Roman',serif;">"${a.tip}"</div>
    </div>

  </td></tr>

  <!-- ═══ BUDTENDER CARD (screenshot this) ═══ -->
  <tr><td style="background:#F7F5F0;padding:0 40px;">
    <div style="height:16px;"></div>
    <div style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9A9A82;text-align:center;margin-bottom:10px;">Screenshot this · Show it at the counter</div>
  </td></tr>
  <tr><td style="padding:0 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#1B4332 0%,#2D6A4F 100%);border-radius:16px;overflow:hidden;">
    <tr><td style="padding:28px 30px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#74C69D;margin-bottom:10px;">My Cannascope</div>
      <div style="font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;margin-bottom:4px;font-family:Georgia,'Times New Roman',serif;">${a.label}</div>
      <div style="font-size:13px;color:#A7C4B5;margin-bottom:16px;">${a.tagline}</div>
      <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:14px;">
        <div style="font-size:11px;color:#74C69D;font-weight:600;margin-bottom:6px;">Looking for:</div>
        <div style="font-size:13px;color:#E8F5EE;line-height:1.7;">${a.strains.slice(0,3).join(' &nbsp;·&nbsp; ')}</div>
        <div style="font-size:12px;color:#A7C4B5;margin-top:8px;">Terpenes: ${a.terpenes.slice(0,2).join(', ')}</div>
      </div>
    </td></tr>
    </table>
  </td></tr>

  <!-- ═══ SPACER ═══ -->
  <tr><td style="background:#F7F5F0;padding:0 40px;"><div style="height:24px;"></div></td></tr>

  <!-- ═══ RETAKE CTA ═══ -->
  <tr><td style="background:#FFFFFF;border-radius:12px;margin:0 40px;padding:0;">
  </td></tr>
  <tr><td style="padding:0 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:12px;border:1px solid #EBEBEB;">
    <tr><td style="padding:22px 24px;text-align:center;">
      <div style="font-size:14px;color:#5A5A48;margin-bottom:12px;">Want to explore a different goal?</div>
      <a href="https://whatshouldigetatthedispensary.com" style="display:inline-block;background:#1B4332;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:100px;">Retake the quiz &rarr;</a>
    </td></tr>
    </table>
  </td></tr>

  <!-- ═══ FOOTER ═══ -->
  <tr><td style="background:#F7F5F0;border-radius:0 0 20px 20px;padding:28px 40px;text-align:center;">
    <div style="font-size:14px;font-weight:700;color:#1B4332;letter-spacing:-0.01em;margin-bottom:4px;">Cannascope</div>
    <div style="font-size:11px;color:#9A9A82;line-height:1.8;">
      Cannabis intelligence for the dispensary floor.<br>
      <a href="https://whatshouldigetatthedispensary.com" style="color:#40916C;text-decoration:none;">whatshouldigetatthedispensary.com</a>
    </div>
    <div style="margin-top:16px;font-size:10px;color:#C0C0B0;">
      You received this because you requested your recommendation.<br>
      This email was sent to you by Cannascope.
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, archetype, answers } = req.body || {};
  if (!email || !archetype) return res.status(400).json({ error: 'Missing email or archetype' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const html = buildEmailHtml(archetype, answers || {});
  if (!html) return res.status(400).json({ error: 'Unknown archetype' });

  const a = ARCHETYPES[archetype];

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cannascope <maxwell@cannascope.us>',
        to: [email],
        subject: `You're ${a.label} — here's exactly what to get`,
        html,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('[send-quiz-email] Resend error:', data);
      return res.status(502).json({ error: 'Email delivery failed', detail: data });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('[send-quiz-email] Exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
