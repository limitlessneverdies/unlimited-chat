// === UNLIMITED.SURF WORKER PROXY ===
// Hides the upstream API key, enforces a per-IP daily request cap, and
// gates premium models behind a cheap-model allowlist for the free tier.
//
// Deploy: see DEPLOY.md for the exact Cloudflare setup steps.

export interface Env {
  // Secret — set via `wrangler secret put API_KEY`. Never shipped to the browser.
  API_KEY: string;
  // KV namespace binding — create via `wrangler kv namespace create RATELIMIT`.
  RATELIMIT: KVNamespace;
}

const UPSTREAM = 'https://unlimited.surf';

// Endpoints the frontend is allowed to reach through the proxy.
const ALLOWED_PATHS = new Set([
  '/v1/messages',
  '/v1/models',
  '/api/models',
  '/api/search',
  '/api/merge',
  '/api/attachments/extract',
]);

// Free-tier model allowlist — cheap models only. Premium models require a
// (future) Pro token; for ads-only v1 they're simply rejected server-side.
const FREE_MODELS = new Set([
  'gateway-gemini-2.5-flash',
  'gateway-gpt-5-nano',
  'gateway-gpt-5-mini',
  'gateway-deepseek-v4-flash',
]);

const DAILY_CAP = 30;

function today(): string {
  // YYYY-MM-DD in UTC — the rate-limit window key.
  return new Date().toISOString().slice(0, 10);
}

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (!ALLOWED_PATHS.has(url.pathname)) {
      return json({ error: 'Not found' }, 404, origin);
    }

    // --- Identify caller for rate limiting ---
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `rl:${ip}:${today()}`;

    // GET endpoints (model catalog) are cheap and not rate-limited.
    const isModelList = url.pathname === '/api/models' || url.pathname === '/v1/models';

    // --- Parse body once for POST so we can inspect the model + reuse it ---
    let bodyText: string | null = null;
    let parsedBody: any = null;
    if (req.method === 'POST') {
      bodyText = await req.text();
      try { parsedBody = JSON.parse(bodyText); } catch { parsedBody = null; }
    }

    // --- Free-tier model enforcement (the real gate; can't be bypassed via JS) ---
    if (!isModelList && parsedBody?.model) {
      const model: string = parsedBody.model;
      if (!FREE_MODELS.has(model)) {
        return json(
          { error: 'premium_model', message: 'This model requires Pro. Pick a free model or upgrade.' },
          403,
          origin,
        );
      }
    }

    // --- Per-IP daily rate limit ---
    if (!isModelList) {
      const raw = await env.RATELIMIT.get(rlKey);
      const count = raw ? parseInt(raw, 10) || 0 : 0;
      if (count >= DAILY_CAP) {
        return json(
          { error: 'rate_limited', message: `Daily free limit reached (${DAILY_CAP}). Watch an ad to unlock more, or come back tomorrow.`, cap: DAILY_CAP, used: count },
          429,
          origin,
        );
      }
      // Increment with a 24h TTL so the key self-expires.
      await env.RATELIMIT.put(rlKey, String(count + 1), { expirationTtl: 86400 });
    }

    // --- Forward to upstream with the real key attached server-side ---
    const upstreamHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': env.API_KEY,
      'anthropic-version': '2023-06-01',
      'Authorization': `Bearer ${env.API_KEY}`,
    };

    const upstreamReq = new Request(`${UPSTREAM}${url.pathname}`, {
      method: req.method,
      headers: upstreamHeaders,
      body: req.method === 'POST' ? bodyText : undefined,
    });

    const upstreamRes = await fetch(upstreamReq);

    // Stream the response body straight through (SSE-safe) with CORS headers.
    const headers = new Headers(upstreamRes.headers);
    const c = cors(origin);
    for (const k in c) headers.set(k, c[k]);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers,
    });
  },
};
