// api/dutchie-resolve.js — Vercel serverless function
// ─────────────────────────────────────────────────────────────────────────────
// Resolves a Dutchie dispensary slug → dispensary ID by fetching the page
// server-side (no CORS restrictions).
//
// GET /api/dutchie-resolve?slug=bud-and-honey
//
// Response: { dispensaryId: "5f3a...", slug: "bud-and-honey" }
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) {
    return res.status(400).json({ error: 'slug query parameter is required' });
  }

  try {
    const pageUrl = `https://dutchie.com/dispensary/${encodeURIComponent(slug)}`;
    const resp    = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return res.status(404).json({
        error: `Dutchie page not found for slug "${slug}" (HTTP ${resp.status}). Check the URL is correct.`,
      });
    }

    const html = await resp.text();
    let dispensaryId   = null;
    let dispensaryName = null;

    // ── Strategy 1: parse __NEXT_DATA__ JSON (most reliable) ─────────────────
    const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nd = JSON.parse(nextDataMatch[1]);

        // Walk common paths
        const d = nd?.props?.pageProps?.dispensary
               || nd?.props?.pageProps?.apolloState && Object.values(nd.props.pageProps.apolloState)
                    .find(v => v?.__typename === 'Dispensary')
               || null;

        if (d) {
          dispensaryId   = d._id || d.id || null;
          dispensaryName = d.name || null;
        }

        // Fallback: grep the raw JSON string for 24-char hex IDs near "dispensary"
        if (!dispensaryId) {
          const str   = JSON.stringify(nd);
          const m     = str.match(/"(?:_id|dispensaryId|DispensaryID)"\s*:\s*"([a-f0-9]{24})"/i);
          if (m) dispensaryId = m[1];
        }
      } catch (_) { /* JSON parse failed — fall through to regex */ }
    }

    // ── Strategy 2: raw HTML regex (fallback) ────────────────────────────────
    if (!dispensaryId) {
      const patterns = [
        /"(?:_id|dispensaryId|DispensaryID)"\s*:\s*"([a-f0-9]{24})"/i,
        /dispensaryId['":\s=]+['"]([a-f0-9]{24})['"]/i,
        /"id":"([a-f0-9]{24})"/,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m) { dispensaryId = m[1]; break; }
      }
    }

    // ── Strategy 3: extract name from <title> ────────────────────────────────
    if (!dispensaryName) {
      const titleMatch = html.match(/<title[^>]*>([^<|–—-]+)/i);
      if (titleMatch) dispensaryName = titleMatch[1].trim();
    }

    if (!dispensaryId) {
      return res.status(422).json({
        error: 'Could not extract dispensary ID from Dutchie page. '
             + 'Paste your 24-character dispensary ID directly (find it in Dutchie POS Settings).',
      });
    }

    // Cache for 1 hour — dispensary IDs don't change
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ dispensaryId, dispensaryName: dispensaryName || null, slug });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
