// === MODEL CATALOG ===
export function isFreeModel(id: string): boolean {
  return FREE_MODELS.has(id);
}

export function isPremiumModel(id: string): boolean {
  return !isFreeModel(id);
}

// Static fallback list + dynamic gateway-fetched enrichment.
// The chat UI prefers the dynamic list once loaded; static is a fallback
// for first paint / offline / gateway failure.

import { API_BASE } from './client';

export type Vendor = 'anthropic' | 'openai' | 'google' | 'xai' | 'meta' | 'mistral' | 'deepseek' | 'other';
export type Tier = 'flagship' | 'fast' | 'reasoning' | 'vision' | 'open';

export interface ModelDef {
  id: string;
  label: string;
  vendor: Vendor;
  tier: Tier;
  desc: string;
  contextK?: number;     // context window, in K tokens
  capabilities?: string[]; // e.g. ['vision','tools','search']
}

// Optional richer shape returned by the store after enrichment.
export interface EnrichedModel extends ModelDef {
  available: boolean;
  raw?: any;
}

// ---------- FREE-MODEL ALLOWLIST ----------
// Must stay in sync with worker/index.ts FREE_MODELS. Models in this set are
// available to free-tier users; everything else is gated behind "Pro".
export const FREE_MODELS = new Set([
  'gateway-gemini-2.5-flash',
  'gateway-gpt-5-nano',
  'gateway-gpt-5-mini',
  'gateway-deepseek-v4-flash',
]);

// ---------- STATIC FALLBACK ----------
export const MODELS: ModelDef[] = [
  { id: 'claude-opus-4-7-20260101',  label: 'Claude Opus 4.7',   vendor: 'anthropic', tier: 'flagship',  desc: 'Deepest reasoning, longest context.',       contextK: 500 },
  { id: 'claude-sonnet-4-5',         label: 'Claude Sonnet 4.5', vendor: 'anthropic', tier: 'fast',      desc: 'Fast, balanced, daily driver.',              contextK: 200 },
  { id: 'claude-haiku-4',            label: 'Claude Haiku 4',    vendor: 'anthropic', tier: 'fast',      desc: 'Fastest Claude, light tasks.',               contextK: 200 },
  { id: 'gateway-gpt-5',             label: 'GPT-5',             vendor: 'openai',    tier: 'flagship',  desc: 'OpenAI flagship.',                           contextK: 400 },
  { id: 'gateway-gpt-5-mini',        label: 'GPT-5 mini',        vendor: 'openai',    tier: 'fast',      desc: 'Cheap and fast GPT-5.',                      contextK: 200 },
  { id: 'gateway-gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  vendor: 'google',    tier: 'fast',      desc: 'Default free model. Snappy, huge context.',  contextK: 1000 },
  { id: 'gateway-gemini-2.5-pro',    label: 'Gemini 2.5 Pro',    vendor: 'google',    tier: 'flagship',  desc: 'Google flagship multimodal.',                contextK: 1000 },
  { id: 'gateway-gemini-3-flash',    label: 'Gemini 3 Flash',    vendor: 'google',    tier: 'fast',      desc: 'Snappy, huge context.',                      contextK: 1000 },
  { id: 'gateway-o3',                label: 'o3',                vendor: 'openai',    tier: 'reasoning', desc: 'Deep reasoning chain.',                       contextK: 200 },
  { id: 'gateway-grok-4',            label: 'Grok 4',            vendor: 'xai',       tier: 'flagship',  desc: 'xAI flagship, real-time.',                    contextK: 256 },
  { id: 'gateway-llama-4-405b',      label: 'Llama 4 405B',      vendor: 'meta',      tier: 'open',      desc: 'Open-weight flagship.',                       contextK: 128 },
];

/** Default model for new chats — must be in FREE_MODELS */
export const DEFAULT_MODEL = 'gateway-gemini-2.5-flash';

export function modelById(id: string, pool: ModelDef[] = MODELS): ModelDef | undefined {
  return pool.find((m) => m.id === id);
}

export function vendorAccent(v: Vendor): string {
  switch (v) {
    case 'anthropic': return '#cc7755';
    case 'openai':    return '#10a37f';
    case 'google':    return '#4285f4';
    case 'xai':       return '#ffffff';
    case 'meta':      return '#0866ff';
    case 'mistral':   return '#ff7000';
    case 'deepseek':  return '#4d6bfe';
    default:          return '#888';
  }
}

// ---------- DYNAMIC FETCH ----------
export interface GatewayModel {
  id: string;
  label?: string;
  display_name?: string;
  name?: string;
  vendor?: string;
  provider?: string;
  family?: string;
  description?: string;
  context_window?: number;
  context_length?: number;
  max_input_tokens?: number;
  capabilities?: string[];
  modalities?: string[];
  available?: boolean;
  status?: string;
  tier?: string;
}

/**
 * Fetch the multi-provider model catalog from the gateway.
 * The selector must use /api/models; /v1/models is upstream Anthropic-shaped
 * and can only expose Claude models.
 */
export async function fetchModels(): Promise<GatewayModel[]> {
  const url = `${API_BASE}/api/models`;

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    const raw: any[] =
      Array.isArray(json) ? json :
      Array.isArray(json?.data) ? json.data :
      Array.isArray(json?.models) ? json.models :
      [];
    return raw as GatewayModel[];
  } catch {
    return [];
  }
}

// ---------- ENRICHMENT ----------
function inferVendor(m: GatewayModel): Vendor {
  const id = (m.id || '').toLowerCase();
  const v = (m.vendor || m.provider || m.family || '').toLowerCase();
  if (v.includes('anthropic') || id.includes('claude')) return 'anthropic';
  if (v.includes('openai')   || id.includes('gpt') || id.includes('o3') || id.includes('o1')) return 'openai';
  if (v.includes('google')   || id.includes('gemini')) return 'google';
  if (v.includes('xai')      || id.includes('grok')) return 'xai';
  if (v.includes('meta')     || id.includes('llama')) return 'meta';
  if (v.includes('mistral')) return 'mistral';
  if (v.includes('deepseek') || id.includes('deepseek')) return 'deepseek';
  return 'other';
}

function inferTier(m: GatewayModel, vendor: Vendor): Tier {
  const id = (m.id || '').toLowerCase();
  const t = (m.tier || '').toLowerCase();
  if (t.includes('reason')) return 'reasoning';
  if (id.includes('o3') || id.includes('o1') || id.includes('reason') || id.includes('thinking')) return 'reasoning';
  if (id.includes('haiku') || id.includes('mini') || id.includes('flash') || id.includes('nano')) return 'fast';
  if (vendor === 'meta' || id.includes('llama')) return 'open';
  if (id.includes('vision') || (m.modalities || []).includes('image')) return 'vision';
  return 'flagship';
}

function prettifyLabel(id: string, fallback?: string): string {
  if (fallback && fallback !== id) return fallback;
  return id
    .replace(/^gateway-/, '')
    .replace(/-(\d{8})$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function enrich(m: GatewayModel): EnrichedModel {
  const vendor = inferVendor(m);
  const tier = inferTier(m, vendor);
  const label = prettifyLabel(m.id, m.label || m.display_name || m.name);
  const ctx = m.context_window || m.context_length || m.max_input_tokens;
  // Try to inherit description from static catalog if we know this id
  const known = MODELS.find((s) => s.id === m.id);
  return {
    id: m.id,
    label,
    vendor,
    tier,
    desc: m.description || known?.desc || `${vendor} · ${tier}`,
    contextK: ctx ? Math.round(ctx / 1000) : known?.contextK,
    capabilities: m.capabilities || m.modalities,
    available: m.available !== false && m.status !== 'unavailable',
    raw: m,
  };
}
