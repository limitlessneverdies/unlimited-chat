# DEPLOY — unlimited-chat

## Architecture

```
Browser ──► Cloudflare Pages (static SPA)
                │
                ▼
         Cloudflare Worker (proxy)
                │
                ▼
         unlimited.surf (upstream API)
```

The browser **never** holds the API key. All requests go through the Worker
proxy, which attaches the key server-side and enforces a per-IP daily cap.

---

## Step-by-step

### 1. Create the KV namespace (rate-limit storage)

```bash
cd worker
wrangler kv namespace create RATELIMIT
```

Copy the `id` from the output and paste it into `worker/wrangler.toml`
(replace `YOUR_KV_NAMESPACE_ID_HERE`).

### 2. Store the upstream API key as a Worker secret

```bash
wrangler secret put API_KEY
# paste your unlimited.surf API key when prompted
```

### 3. Deploy the Worker

```bash
cd worker
wrangler deploy
```

Note the deployed URL, e.g. `unlimited-chat-proxy.<your-subdomain>.workers.dev`.

### 4. Connect the repo to Cloudflare Pages

1. Go to **Cloudflare Dashboard → Pages → Create a project**
2. Connect your GitHub repo (`unlimited-chat`)
3. Set build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `22` (set in environment variable `NODE_VERSION=22`)

### 5. Set the Worker URL on Pages

In the Pages project → **Settings → Environment variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE` | `https://unlimited-chat-proxy.<your-subdomain>.workers.dev` |

This tells the frontend to route all API calls through your Worker instead of
hitting `unlimited.surf` directly (which would fail without a key).

### 6. Deploy

Push to your repo's main branch. Cloudflare Pages will automatically build
and deploy.

---

## Adsterra setup

1. Sign up at [adsterra.com](https://adsterra.com)
2. Create ad units and get your zone IDs
3. Replace the placeholder IDs in `src/components/AdSlot.tsx`:
   ```ts
   const ZONES: Record<string, string> = {
     sidebar: 'YOUR_SIDEBAR_ZONE_ID',
     'between-messages': 'YOUR_BETWEEN_MSGS_ZONE_ID',
   };
   ```
4. For rewarded ads (429 screen), integrate Adsterra's rewarded video API
   in `src/components/RewardAd.tsx` (currently simulated with a 3s timeout).

---

## Rate limits

- **Daily cap:** 30 requests per IP (configurable in `worker/index.ts` → `DAILY_CAP`)
- **Free models only:** `gateway-gemini-2.5-flash`, `gateway-gpt-5-nano`, `gateway-gpt-5-mini`, `gateway-deepseek-v4-flash`
- Premium models return 403 from the Worker
- Model catalog fetches (`/api/models`, `/v1/models`) are **not** rate-limited

---

## Local development

```bash
npm run dev    # Vite dev server on localhost:5173
```

For local Worker testing:
```bash
cd worker
wrangler dev   # Starts a local Worker proxy
```

Then set `VITE_API_BASE=http://localhost:8787` in a `.env` file.

---

## Checklist

- [ ] KV namespace created and ID pasted into `wrangler.toml`
- [ ] `API_KEY` secret stored via `wrangler secret put`
- [ ] Worker deployed with `wrangler deploy`
- [ ] Pages project connected to GitHub repo
- [ ] `VITE_API_BASE` environment variable set on Pages
- [ ] Adsterra zone IDs replaced in `AdSlot.tsx`
- [ ] Push to main → Pages auto-deploys
