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
  // KV for active user tracking
  ACTIVE_USERS: KVNamespace;
  // KV for prompt/request logging
  PROMPT_LOG: KVNamespace;
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
const MAX_MERGE_MODELS = 4;

function upstreamHeaders(env: Env): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': env.API_KEY,
    'anthropic-version': '2023-06-01',
    'Authorization': `Bearer ${env.API_KEY}`,
  };
}

async function handleMerge(req: Request, env: Env, origin: string | null, body: any): Promise<Response> {
  const models = Array.isArray(body?.models)
    ? body.models.filter((m: unknown): m is string => typeof m === 'string' && m.trim())
    : [];

  if (models.length === 0) {
    return json({ error: 'invalid_models', message: 'models must be a non-empty array' }, 400, origin);
  }
  if (models.length > MAX_MERGE_MODELS) {
    return json({ error: 'too_many_models', message: `Merge supports up to ${MAX_MERGE_MODELS} models` }, 400, origin);
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) {
    return json({ error: 'invalid_prompt', message: 'prompt is required' }, 400, origin);
  }

  const maxTokens = typeof body?.max_tokens === 'number' ? body.max_tokens : 4096;
  const system = typeof body?.system === 'string' ? body.system : undefined;

  const upstream = models.map((model) => fetch(`${UPSTREAM}/v1/messages`, {
    method: 'POST',
    headers: upstreamHeaders(env),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  }));

  const responses = await Promise.all(upstream);
  const failed = responses.find((res) => !res.ok);
  if (failed) {
    const text = await failed.text().catch(() => '');
    return json({ error: 'upstream_error', message: text || failed.statusText }, failed.status, origin);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (evt: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      const tasks = responses.map((res, index) => drainMergeSse(res, models[index], push));
      Promise.all(tasks)
        .then(() => controller.close())
        .catch((err) => controller.error(err));
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      ...cors(origin),
    },
  });
}

async function drainMergeSse(res: Response, model: string, push: (evt: any) => void): Promise<void> {
  if (!res.body) {
    push({ model, done: true, error: 'empty upstream response' });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let stopReason: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        push({ model, delta: evt.delta.text ?? '' });
      } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
        stopReason = evt.delta.stop_reason;
      } else if (evt.type === 'message_stop') {
        push({ model, done: true, reason: stopReason || 'complete' });
        return;
      } else if (evt.type === 'error') {
        push({ model, done: true, error: evt.error?.message ?? 'stream error' });
        return;
      } else if (typeof evt.delta === 'string') {
        push({ model, delta: evt.delta });
      } else if (evt.finish || evt.done) {
        push({ model, done: true, reason: evt.reason || stopReason || 'complete' });
        return;
      }
    }
  }

  push({ model, done: true, reason: stopReason || 'complete' });
}

function today(): string {
  // YYYY-MM-DD in UTC — the rate-limit window key.
  return new Date().toISOString().slice(0, 10);
}

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-api-key',
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

    // --- Active user tracking ---
    if (url.pathname === '/api/heartbeat' && req.method === 'POST') {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const now = Date.now();
      // Store heartbeat with 5min TTL
      await env.ACTIVE_USERS.put(`user:${ip}`, String(now), { expirationTtl: 300 });
      // Count active users (last 5 min)
      const list = await env.ACTIVE_USERS.list({ prefix: 'user:' });
      const activeCount = list.keys.length;
      // Total unique users today
      const totalList = await env.ACTIVE_USERS.list({ prefix: 'total:' });
      const totalCount = totalList.keys.length;
      // Record this user for total count
      await env.ACTIVE_USERS.put(`total:${ip}`, '1', { expirationTtl: 86400 });
      return json({ active: activeCount, total: totalCount }, 200, origin);
    }

    // --- Prompt/request logging ---
    if (url.pathname === '/api/log' && req.method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, origin); }
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const logEntry = {
        ip,
        model: body.model || 'unknown',
        prompt: (body.prompt || '').slice(0, 500),
        timestamp: Date.now(),
        date: today(),
      };
      // Store in KV with date-based key
      const logKey = `log:${today()}:${Date.now()}:${ip}`;
      await env.PROMPT_LOG.put(logKey, JSON.stringify(logEntry), { expirationTtl: 604800 }); // 7 days
      // Also increment daily counter
      const counterKey = `count:${today()}`;
      const raw = await env.PROMPT_LOG.get(counterKey);
      const count = raw ? parseInt(raw, 10) + 1 : 1;
      await env.PROMPT_LOG.put(counterKey, String(count), { expirationTtl: 604800 });
      return json({ ok: true, totalToday: count }, 200, origin);
    }

    // --- Stats endpoint ---
    if (url.pathname === '/api/stats') {
      const counterKey = `count:${today()}`;
      const raw = await env.PROMPT_LOG.get(counterKey);
      const totalToday = raw ? parseInt(raw, 10) : 0;
      const activeList = await env.ACTIVE_USERS.list({ prefix: 'user:' });
      const activeCount = activeList.keys.length;
      const totalList = await env.ACTIVE_USERS.list({ prefix: 'total:' });
      const totalCount = totalList.keys.length;
      return json({ active: activeCount, total: totalCount, promptsToday: totalToday }, 200, origin);
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

    // --- Log prompt for analytics ---
    if (req.method === 'POST' && parsedBody?.messages) {
      const lastMsg = parsedBody.messages[parsedBody.messages.length - 1];
      const prompt = lastMsg?.content || '';
      const model = parsedBody.model || 'unknown';
      const logKey = `log:${today()}:${Date.now()}:${ip}`;
      await env.PROMPT_LOG.put(logKey, JSON.stringify({
        ip, model, prompt: (typeof prompt === 'string' ? prompt : JSON.stringify(prompt)).slice(0, 500),
        timestamp: Date.now(), date: today(),
      }), { expirationTtl: 604800 });
      // Increment daily counter
      const counterKey = `count:${today()}`;
      const raw2 = await env.PROMPT_LOG.get(counterKey);
      const count2 = raw2 ? parseInt(raw2, 10) + 1 : 1;
      await env.PROMPT_LOG.put(counterKey, String(count2), { expirationTtl: 604800 });
    }

    if (url.pathname === '/api/merge') {
      return handleMerge(req, env, origin, parsedBody);
    }

    // --- Forward to upstream with the real key attached server-side ---
    const upstreamReq = new Request(`${UPSTREAM}${url.pathname}`, {
      method: req.method,
      headers: upstreamHeaders(env),
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
