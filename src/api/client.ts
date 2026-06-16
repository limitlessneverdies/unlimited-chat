// === UNLIMITED.SURF API CLIENT ===
// All requests go through the Cloudflare Worker proxy, which attaches the
// upstream API key server-side. The key is NEVER present in browser code.
//
// Set VITE_API_BASE in your Cloudflare Pages env (or .env) to the deployed
// Worker URL, e.g. https://unlimited-proxy.<your-subdomain>.workers.dev

const configuredBase =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '');

export const API_BASE = (() => {
  if (configuredBase) return configuredBase;
  if (import.meta.env.DEV) return 'http://localhost:8787';
  throw new Error('VITE_API_BASE is required in production. Point it to the Cloudflare Worker URL, not unlimited.surf.');
})();

export interface RateLimitPayload {
  error?: string;
  message: string;
  cap: number;
  used: number;
}

export class RateLimitError extends Error {
  cap: number;
  used: number;
  constructor(message: string, cap: number, used: number) {
    super(message);
    this.name = 'RateLimitError';
    this.cap = cap;
    this.used = used;
  }
}

function parseRateLimit(text: string, status = 429): RateLimitError {
  let json: RateLimitPayload | null = null;
  try { json = JSON.parse(text); } catch { json = null; }
  const msg = json?.message || text || `Daily limit reached (${status})`;
  const cap = json?.cap ?? 30;
  const used = json?.used ?? cap;
  return new RateLimitError(msg, cap, used);
}

function stripSecretHeaders(headers: HeadersInit): HeadersInit {
  if (Array.isArray(headers)) {
    return headers.filter(([key]) => key.toLowerCase() !== 'authorization' && key.toLowerCase() !== 'x-api-key');
  }
  if (headers instanceof Headers) {
    headers.delete('authorization');
    headers.delete('x-api-key');
    return headers;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower !== 'authorization' && lower !== 'x-api-key') out[key] = value;
  }
  return out;
}

function requestHeaders(): HeadersInit {
  return stripSecretHeaders({ 'content-type': 'application/json' });
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model: string;
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onDone: (stopReason?: string) => void;
  onError: (err: Error) => void;
}

/**
 * Stream a chat completion from /v1/messages (Anthropic-compatible).
 * Parses SSE events: content_block_delta, message_stop, error.
 */
export async function streamChat(opts: StreamOptions): Promise<void> {
  const {
    model,
    messages,
    system,
    maxTokens = 4096,
    signal,
    onDelta,
    onDone,
    onError,
  } = opts;

  try {
    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        ...(system ? { system } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      // Parse 429 rate limit from the Worker proxy
      if (res.status === 429) {
        throw parseRateLimit(text);
      }
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
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
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        let evt: any;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }

        // Anthropic-style events
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          onDelta(evt.delta.text ?? '');
        } else if (evt.type === 'message_delta' && evt.delta?.stop_reason) {
          stopReason = evt.delta.stop_reason;
        } else if (evt.type === 'message_stop') {
          // final
        } else if (evt.type === 'error') {
          throw new Error(evt.error?.message ?? 'stream error');
        }
        // Also handle the legacy /api/chat shape just in case
        else if (typeof evt.delta === 'string') {
          onDelta(evt.delta);
        } else if (evt.finish || evt.done) {
          stopReason = evt.reason ?? stopReason;
        }
      }
    }

    onDone(stopReason);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone('aborted');
      return;
    }
    onError(err);
  }
}

/**
 * Web search via /api/search — returns sources + streamed answer.
 */
export interface SearchSource { title: string; url: string; snippet?: string; }
export interface SearchOptions {
  query: string;
  model: string;
  effort?: 'low' | 'medium' | 'high';
  signal?: AbortSignal;
  onSources: (sources: SearchSource[]) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export async function streamSearch(opts: SearchOptions): Promise<void> {
  const { query, model, effort = 'medium', signal, onSources, onDelta, onDone, onError } = opts;
  try {
    const res = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({ query, model, effort }),
      signal,
    });
    if (!res.ok || !res.body) {
      if (res.status === 429) throw parseRateLimit(await res.text().catch(() => ''));
      throw new Error(`Search ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
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
        try {
          const evt = JSON.parse(payload);
          if (Array.isArray(evt.results)) onSources(evt.results);
          if (typeof evt.delta === 'string') onDelta(evt.delta);
          if (evt.done) onDone();
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (err: any) {
    if (err.name === 'AbortError') { onDone(); return; }
    onError(err);
  }
}

/**
 * Multi-model merge — fan a single prompt out to N models and stream each
 * answer in parallel. Falls back to N parallel streamChat() calls if the
 * gateway has no dedicated /api/merge endpoint.
 */
export interface MergeOptions {
  prompt: string;
  system?: string;
  models: string[];
  signal?: AbortSignal;
  onDelta: (modelId: string, delta: string) => void;
  onDone: (modelId: string, err?: string) => void;
}

export async function streamMerge(opts: MergeOptions): Promise<void> {
  const { prompt, system, models, signal, onDelta, onDone } = opts;
  let shouldFallback = false;

  try {
    const res = await fetch(`${API_BASE}/api/merge`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({ prompt, system, models, stream: true }),
      signal,
    });

    if (res.status === 429) {
      throw parseRateLimit(await res.text().catch(() => ''));
    }
    if (res.status === 404 || res.status === 501 || !res.body) {
      shouldFallback = true;
    } else if (res.ok) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const seen = new Set<string>();
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
          try {
            const evt = JSON.parse(payload);
            const mid = evt.model || evt.model_id;
            if (!mid) continue;
            if (typeof evt.delta === 'string') onDelta(mid, evt.delta);
            if (evt.done || evt.finish) {
              if (!seen.has(mid)) { seen.add(mid); onDone(mid, evt.error); }
            }
          } catch { /* skip */ }
        }
      }
      for (const m of models) if (!seen.has(m)) onDone(m);
      return;
    } else {
      const text = await res.text().catch(() => '');
      throw new Error(`Merge ${res.status}: ${text || res.statusText}`);
    }
  } catch (err: any) {
    if (err instanceof RateLimitError || err.name === 'AbortError') throw err;
    shouldFallback = true;
  }

  if (!shouldFallback) return;

  // Fallback: sequential streamChat calls so a 429 stops the fanout before it
  // burns the remaining per-IP daily requests.
  for (const m of models) {
    let failed: RateLimitError | null = null;
    await streamChat({
      model: m,
      messages: [{ role: 'user', content: prompt }],
      system,
      signal,
      onDelta: (d) => onDelta(m, d),
      onDone: () => onDone(m),
      onError: (e) => {
        if (e instanceof RateLimitError) failed = e;
        onDone(m, e.message);
      },
    });
    if (failed) throw failed;
  }
}

/**
 * Extract text from an uploaded file (PDF/DOCX/XLSX/text).
 */
export async function extractFile(file: File): Promise<{ name: string; text: string; truncated: boolean }> {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await fetch(`${API_BASE}/api/attachments/extract`, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      name: file.name,
      type: file.type || 'application/octet-stream',
      data: b64,
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw parseRateLimit(await res.text().catch(() => ''));
    throw new Error(`Extract failed (${res.status})`);
  }
  const json = await res.json();
  return { name: json.name, text: json.text ?? '', truncated: !!json.truncated };
}

/**
 * Generate a short (3-5 word) chat title from the first exchange. Non-streaming,
 * cheap/fast model. Returns a truncation fallback if the call fails so callers
 * always get something usable.
 */
export async function generateTitle(
  userText: string,
  assistantText: string,
  model = 'gateway-gemini-2.5-flash',
): Promise<string> {
  const fallback = userText.replace(/\s+/g, ' ').trim().slice(0, 48) || 'New chat';
  try {
    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        model,
        max_tokens: 20,
        messages: [
          {
            role: 'user',
            content:
              'Summarize this conversation as a 3-5 word title. Reply with ONLY the title — no quotes, no punctuation, no preface.\n\n' +
              `User: ${userText.slice(0, 600)}\n\nAssistant: ${assistantText.slice(0, 600)}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const text: string =
      json?.content?.[0]?.text ??
      json?.content?.map?.((b: any) => b?.text).join('') ??
      '';
    const clean = text.replace(/^["'#\s]+|["'\s]+$/g, '').trim();
    return clean || fallback;
  } catch {
    return fallback;
  }
}
