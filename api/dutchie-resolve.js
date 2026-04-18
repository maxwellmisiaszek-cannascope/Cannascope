// api/dutchie-resolve.js — Vercel serverless function
// ─────────────────────────────────────────────────────────────────────────────
// Resolves a Dutchie dispensary slug → dispensary ID.
//
// Dutchie pages are client-side rendered — the ID is NOT in the HTML source.
// Instead we try two GraphQL-based approaches that work server-to-server:
//
//   Strategy 1: Try the slug directly as a dispensaryId in FilteredProducts.
//               Some Dutchie configs accept slug=ID, and if it works we're done.
//
//   Strategy 2: Query GetMenuSections with the slug — the response error often
//               contains the canonical dispensaryId.
//
//   Strategy 3: POST a full (non-persisted) GraphQL query for dispensary by slug.
//
// GET /api/dutchie-resolve?slug=bud-and-honey
// Response: { dispensaryId: "662937f6...", slug: "bud-and-honey" }
// ─────────────────────────────────────────────────────────────────────────────

const APQ_HASH_PRODUCTS = '98b4aaef79a84ae804b64d550f98dd64d7ba0aa6d836eb6b5d4b2ae815c95e32';
const APQ_HASH_SECTIONS  = 'fb14fcf58d6cdc05ab5957e15ac09591ebac4fbc8784ea8763db2746688b7599';
const GQL_BASE           = 'https://dutchie.com/api-3/graphql';
const GQL_HEADERS        = {
  'x-apollo-operation-name': 'FilteredProducts',
  'apollo-require-preflight': 'true',
  'Content-Type': 'application/json',
};

// ── Try using the slug directly as dispensaryId in the products API ──────────
async function trySlugAsId(slug) {
  const vars = { productsFilter: { dispensaryId: slug, pricingType: 'rec', Status: 'Active', types: ['Flower'] } };
  const url  = `${GQL_BASE}?operationName=FilteredProducts`
    + `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: APQ_HASH_PRODUCTS } }))}`
    + `&variables=${encodeURIComponent(JSON.stringify(vars))}`;
  const resp = await fetch(url, { headers: GQL_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const data = await resp.json();
  // If we got products back, the slug itself acts as the ID
  if (data?.data?.filteredProducts?.products?.length > 0) return slug;
  return null;
}

// ── Try GetMenuSections — response data may contain the dispensaryId ─────────
async function tryMenuSections(slug) {
  const vars = { dispensaryId: slug };
  const url  = `${GQL_BASE}?operationName=GetMenuSections`
    + `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: APQ_HASH_SECTIONS } }))}`
    + `&variables=${encodeURIComponent(JSON.stringify(vars))}`;
  const resp = await fetch(url, { headers: GQL_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!resp.ok) return null;
  const text = await resp.text();
  // Hunt for a 24-char hex ID in the response
  const m = text.match(/"(?:_id|dispensaryId|DispensaryID)"\s*:\s*"([a-f0-9]{24})"/i);
  return m ? m[1] : null;
}

// ── Try full GraphQL POST with dispensary-by-slug query ──────────────────────
async function tryGraphqlPost(slug) {
  const body = JSON.stringify({
    query: `query GetDispensaryBySlug($slug: String!) {
      dispensaryBySlug(slug: $slug) { _id id name }
    }`,
    variables: { slug },
  });
  const resp = await fetch(GQL_BASE, {
    method:  'POST',
    headers: { ...GQL_HEADERS, 'x-apollo-operation-name': 'GetDispensaryBySlug' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) return null;
  const text = await resp.text();
  const m = text.match(/"(?:_id|id)"\s*:\s*"([a-f0-9]{24})"/i);
  return m ? m[1] : null;
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug parameter required' });

  try {
    let dispensaryId = null;

    dispensaryId = await trySlugAsId(slug).catch(() => null);
    if (!dispensaryId) dispensaryId = await tryMenuSections(slug).catch(() => null);
    if (!dispensaryId) dispensaryId = await tryGraphqlPost(slug).catch(() => null);

    if (!dispensaryId) {
      // All strategies failed — return a helpful error with the console command
      // the user can run on their Dutchie page to get the ID themselves
      return res.status(422).json({
        error:          'auto_resolve_failed',
        consoleCommand: `decodeURIComponent(performance.getEntries().find(e=>e.name&&e.name.includes('dispensaryId')).name.match(/dispensaryId%22%3A%22([a-f0-9]{24})/)[1])`,
        hint:           'Open your Dutchie menu page → F12 → Console → paste the command above → copy the 24-character result',
      });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ dispensaryId, slug });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
