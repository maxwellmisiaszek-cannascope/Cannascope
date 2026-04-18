// api/dutchie.js — Vercel serverless function
// ─────────────────────────────────────────────────────────────────────────────
// Proxies Dutchie's public GraphQL APQ endpoint (no API key required).
// Because this runs server-to-server there are no CORS issues.
// Fetches all 7 product categories, scores them with the Cannascope engine,
// and returns products in the same schema as the Supabase products table.
//
// GET /api/dutchie?dispensaryId=DISPENSARY_ID
//
// Response: { products: [...], count: N, source: 'dutchie-live' }
// Cache:    5-minute Vercel edge cache (stale-while-revalidate: 60s)
// ─────────────────────────────────────────────────────────────────────────────

const APQ_HASH   = '98b4aaef79a84ae804b64d550f98dd64d7ba0aa6d836eb6b5d4b2ae815c95e32';
const CATEGORIES = ['Flower', 'Concentrate', 'Vaporizers', 'Edible', 'Tincture', 'Topicals', 'Pre-Roll'];

const CAT_MAP = {
  Flower: 'flower', Concentrate: 'concentrate', Vaporizers: 'vape',
  Edible: 'edible', Tincture: 'tincture', Topicals: 'topical', 'Pre-Roll': 'preroll',
};

// ── SCORING CONSTANTS (mirrors cannascope-admin.html) ─────────────────────────
const EFFECTS = ['sleep', 'relax', 'focus', 'social', 'relief', 'beginner'];

const STRAIN_BIAS = {
  indica:  { sleep: 0.18, relax: 0.15, focus: -0.12, social: -0.08, relief:  0.10, beginner:  0.05 },
  sativa:  { sleep:-0.15, relax:-0.05, focus:  0.18, social:  0.15, relief: -0.05, beginner: -0.08 },
  hybrid:  { sleep: 0.02, relax: 0.04, focus:  0.04, social:  0.05, relief:  0.02, beginner:  0.04 },
  cbd:     { sleep: 0.08, relax: 0.12, focus:  0.05, social: -0.05, relief:  0.22, beginner:  0.18 },
};

const CAT_MODS = {
  edible:   { sleep: 0.08, relax: 0.05, relief:  0.05, beginner:  0.06 },
  tincture: { sleep: 0.04, relax: 0.03, relief:  0.06, beginner:  0.08 },
  topical:  { relief: 0.18, beginner: 0.10, sleep: -0.08, social: -0.10 },
  vape:     { focus: 0.05, social: 0.05 },
  preroll:  { relax: 0.02, social: 0.04 },
};

const DUTCHIE_EFFECT_MAP = {
  'Relaxed':             { relax: 1.00, sleep: 0.40 },
  'Sleepy':              { sleep: 1.00, relax: 0.50 },
  'Happy':               { social: 0.80, relax: 0.40 },
  'Uplifted':            { social: 0.70, focus: 0.60 },
  'Euphoric':            { social: 1.00, relax: 0.30 },
  'Creative':            { focus: 0.80, social: 0.50 },
  'Energetic':           { focus: 0.90, social: 0.40 },
  'Focused':             { focus: 1.00 },
  'Talkative':           { social: 0.90 },
  'Giggly':              { social: 0.70, relax: 0.30 },
  'Tingly':              { relax: 0.50, relief: 0.40 },
  'Hungry':              { relax: 0.20 },
  'Pain Relief':         { relief: 1.00 },
  'Pain-Relief':         { relief: 1.00 },
  'Anti-Anxiety':        { relax: 0.80, beginner: 0.50 },
  'Anti-Inflammation':   { relief: 0.90 },
  'Headaches':           { relief: 0.80 },
  'Stress':              { relax: 0.80 },
  'Depression':          { social: 0.60, relax: 0.50 },
  'Insomnia':            { sleep: 1.00 },
  'Cramps':              { relief: 0.90 },
  'Muscle Spasms':       { relief: 0.90 },
  'Fatigue':             { focus: 0.70 },
  'Nausea':              { relief: 0.60 },
  'Lack of Appetite':    { relax: 0.30 },
  'Spasticity':          { relief: 0.80 },
  'Eye Pressure':        { relief: 0.60 },
};

const KEYWORD_MAP = {
  sleep:    ['sleep','night','cbn','dream','rest ','slumber','bedtime',' pm','knockout','zz','snooze','dusk','nite'],
  relax:    ['relax','calm','chill','unwind','ease','mellow','serene','tranquil','stress','soothe','gentle'],
  focus:    ['focus','day','daytime','clarity','clear','uplift','energy','morning','alert','productive','wake','bright','rise','elevate','sativa'],
  social:   ['social','party','euphori','happy','uplift','laugh','joy','creative','festival','outdoor','vibe','bliss'],
  relief:   ['relief','pain','recover','inflammation','ache','sore','cramp','therapy','medicinal','cbg','ratio','muscle'],
  beginner: ['micro','microdose','light','gentle','easy','mild','1:1',':1','1mg','2.5mg','5mg','low dose','intro','starter'],
};

// ── SCORE COMPUTATION ──────────────────────────────────────────────────────────
function computeScores(dp, category, strainType, thc, cbd) {
  const scores = Object.fromEntries(EFFECTS.map(fx => [fx, 0.35]));

  // Layer 1: Strain type bias
  const bias = STRAIN_BIAS[strainType] || STRAIN_BIAS.hybrid;
  for (const fx of EFFECTS) scores[fx] = Math.min(1, Math.max(0, scores[fx] + (bias[fx] || 0)));

  // Layer 2: THC/CBD ratio modifiers
  const t = thc || 0, c = cbd || 0;
  if (c > 8)            { scores.relief   = Math.min(1, scores.relief   + 0.20); scores.beginner = Math.min(1, scores.beginner + 0.18); }
  if (c > 3 && t > 3)   { scores.beginner = Math.min(1, scores.beginner + 0.12); scores.relief   = Math.min(1, scores.relief   + 0.10); }
  if (t > 25)           { scores.beginner = Math.max(0, scores.beginner - 0.22); }
  else if (t > 20)      { scores.beginner = Math.max(0, scores.beginner - 0.10); }
  else if (t < 15 && c < 3) { scores.beginner = Math.min(1, scores.beginner + 0.08); }

  // Layer 3: Category modifiers
  const catMod = CAT_MODS[category] || {};
  for (const [fx, delta] of Object.entries(catMod)) {
    scores[fx] = Math.min(1, Math.max(0, (scores[fx] || 0) + delta));
  }

  // Layer 4: Dutchie native effect tags (crowdsourced/manufacturer-declared)
  const dutchieEffects = dp.effects || dp.Effects || null;
  if (dutchieEffects && typeof dutchieEffects === 'object' && !Array.isArray(dutchieEffects)) {
    const vals   = Object.values(dutchieEffects).map(v => parseFloat(v) || 0);
    const maxVal = Math.max(...vals, 1);
    const effBoosts = Object.fromEntries(EFFECTS.map(fx => [fx, 0]));
    for (const [dtcFx, rawVal] of Object.entries(dutchieEffects)) {
      const normalized = (parseFloat(rawVal) || 0) / maxVal;
      const mapping    = DUTCHIE_EFFECT_MAP[dtcFx];
      if (!mapping) continue;
      for (const [goalFx, weight] of Object.entries(mapping)) {
        effBoosts[goalFx] = Math.max(effBoosts[goalFx], normalized * weight);
      }
    }
    const w = 0.35;
    for (const fx of EFFECTS) {
      if (effBoosts[fx] > 0) scores[fx] = Math.min(1, scores[fx] * (1 - w) + effBoosts[fx] * w);
    }
  }

  // Layer 5: Product name keyword boost
  const nameLower = ((dp.Name || dp.name || '') + ' ' + (dp.brandName || dp.brand || '')).toLowerCase();
  for (const fx of EFFECTS) {
    const hits  = (KEYWORD_MAP[fx] || []).filter(kw => nameLower.includes(kw)).length;
    const boost = Math.min(0.20, hits * 0.09);
    if (boost > 0) scores[fx] = Math.min(1, scores[fx] + boost);
  }

  return scores;
}

// ── PRODUCT MAPPER ────────────────────────────────────────────────────────────
function mapProduct(dp, dutchieCategory) {
  const name      = dp.Name || dp.name || dp.productName || '';
  const brand     = dp.brandName || dp.brand || dp.vendor || '';
  const rawStrain = (dp.strainType || dp.strain_type || '').toLowerCase();
  const thcRaw    = dp.THCContent?.range?.[1] ?? dp.THCContent?.value ?? dp.thc ?? null;
  const cbdRaw    = dp.CBDContent?.range?.[1] ?? dp.CBDContent?.value ?? dp.cbd ?? null;
  const thc       = thcRaw != null ? parseFloat(thcRaw) : null;
  const cbd       = cbdRaw != null ? parseFloat(cbdRaw) : null;
  const price     = parseFloat(
    (dp.recPrices && dp.recPrices[0]) || (dp.Prices && dp.Prices[0]) || dp.price || 0
  ) || null;
  const inStock   = dp.Status === 'Active' || (dp.inStock ?? dp.isActive ?? true);
  const dutchieId = String(dp._id || dp.id || '');
  const category  = CAT_MAP[dutchieCategory] || 'flower';

  // Normalize strain type
  let strainType = 'hybrid';
  if (rawStrain.includes('indica')) strainType = 'indica';
  else if (rawStrain.includes('sativa')) strainType = 'sativa';
  else if (rawStrain.includes('cbd') || (cbd && thc && cbd > thc * 0.5)) strainType = 'cbd';

  const scores = computeScores(dp, category, strainType, thc, cbd);
  const effect  = EFFECTS.reduce((best, fx) => scores[fx] > scores[best] ? fx : best, EFFECTS[0]);

  return {
    id:              dutchieId || (name.toLowerCase().replace(/[^a-z0-9]/g, '_')),
    name,
    brand,
    category,
    effect,
    thc:             thc  != null ? thc  : null,
    cbd:             cbd  != null ? cbd  : null,
    price,
    in_stock:        Boolean(inStock),
    // Manager fields empty — merged from Supabase in the browser
    push:            false,
    manager_note:    '',
    talking_points:  '',
    shelf:           '',
    score_sleep:     +scores.sleep.toFixed(3),
    score_relax:     +scores.relax.toFixed(3),
    score_focus:     +scores.focus.toFixed(3),
    score_social:    +scores.social.toFixed(3),
    score_relief:    +scores.relief.toFixed(3),
    score_beginner:  +scores.beginner.toFixed(3),
    _dutchie_id:     dutchieId,
    _strain_type:    strainType,
    _live:           true,
  };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { dispensaryId } = req.query;
  if (!dispensaryId) {
    return res.status(400).json({ error: 'dispensaryId query parameter is required' });
  }

  try {
    const allProducts = [];
    let fetchErrors   = 0;

    for (const cat of CATEGORIES) {
      const variables = {
        productsFilter: { dispensaryId, category: cat, pricingType: 'rec' }
      };
      const url = 'https://dutchie.com/api-3/graphql'
        + '?operationName=FilteredProducts'
        + '&extensions=' + encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: APQ_HASH } }))
        + '&variables='  + encodeURIComponent(JSON.stringify(variables));

      try {
        const resp = await fetch(url, {
          headers: {
            'x-apollo-operation-name': 'FilteredProducts',
            'apollo-require-preflight': 'true',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const products = data?.data?.filteredProducts?.products || [];
          for (const p of products) {
            allProducts.push(mapProduct(p, cat));
          }
        } else {
          fetchErrors++;
        }
      } catch (catErr) {
        fetchErrors++;
        console.error(`[dutchie-api] category ${cat} failed:`, catErr.message);
      }
    }

    if (allProducts.length === 0 && fetchErrors === CATEGORIES.length) {
      return res.status(502).json({ error: 'Could not reach Dutchie API', fetchErrors });
    }

    // 5-min Vercel edge cache — stays fresh without hammering Dutchie on every page load
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      products: allProducts,
      count:    allProducts.length,
      source:   'dutchie-live',
    });
  } catch (err) {
    console.error('[dutchie-api] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
