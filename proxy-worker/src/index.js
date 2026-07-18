// origin has flaky HTTPS (broken cert -> Cloudflare 526); plain HTTP is the only path that works
const ORIGIN = 'http://ibi.zju.edu.cn/PlantscRNAdb_v4/api';
const UPSTREAM_TIMEOUT_MS = 6000;
const UPSTREAM_RETRIES = 1; // 2 attempts total
const CACHE_TTL_SECONDS = 3600; // marker data is static enough to reuse across searches

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchWithRetry(target, options) {
  let lastErr;
  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt++) {
    try {
      const res = await fetch(target, { ...options, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      if (res.ok) return res;
      lastErr = new Error(`upstream HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt < UPSTREAM_RETRIES) await new Promise((r) => setTimeout(r, 500));
  }
  throw lastErr;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = ORIGIN + url.pathname.replace('/proxy', '');
    const body = await request.text();

    // Cache API only keys on GET requests, so fold the POST body into a synthetic cache key
    const cache = caches.default;
    const cacheKey = new Request(target + '?body=' + encodeURIComponent(body), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let upstreamRes;
    try {
      upstreamRes = await fetchWithRetry(target, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://ibi.zju.edu.cn',
          'Referer': 'http://ibi.zju.edu.cn/plantscrnadb/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
        body: body || undefined,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'upstream_unavailable', message: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const data = await upstreamRes.text();
    const response = new Response(data, {
      status: upstreamRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        ...CORS_HEADERS,
      },
    });

    if (upstreamRes.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
