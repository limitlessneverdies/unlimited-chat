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
proxy, which attaches the key server-side, exposes `/api/models` for the full
model selector, and enforces a per-IP daily cap.

---

## Monetization plan

### V1 — free, ad-supported launch

- Keep the UX free and fast with a hard server-side cap of **30 requests/day/IP**.
- Show Adsterra placements in the sidebar, between long message threads, and on
  the 429 rewarded-unlock screen.
- Use the 429 screen as the conversion surface: “watch an ad to unlock more”
  with a simulated local callback until the real Adsterra rewarded-video callback
  is wired.
- Add optional link monetization later with a lightweight landing/share page; do
  not add redirects that damage trust before traffic is validated.

### V2 — paid/pro only after demand is proven

- Add Pro only after the free tier proves retention and ad fill.
- Pro should start as a higher daily cap or priority queue, not a complicated
  subscription stack.
- Keep the free tier usable so ads remain the main monetization channel.

### Publishing path

- Frontend: Cloudflare Pages.
- Backend proxy/key hiding: Cloudflare Worker.
- Domain: start with the free Cloudflare subdomain; add a custom/free domain
  only after the free-tier economics are proven.

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
   <AdSlot placement="sidebar" zoneId="YOUR_SIDEBAR_ZONE_ID" />
   <AdSlot placement="between-messages" zoneId="YOUR_BETWEEN_MSGS_ZONE_ID" />
   <AdSlot placement="rewarded" zoneId="YOUR_REWARDED_ZONE_ID" />
   ```
4. For rewarded ads (429 screen), integrate Adsterra's rewarded video API
   in `src/components/RewardAd.tsx` and call `onUnlock()` only after the verified
   completion callback.

---

## Rate limits

- **Daily cap:** 30 requests per IP (configurable in `worker/index.ts` → `DAILY_CAP`)
- **Free models only:** `gateway-gemini-2.5-flash`, `gateway-gpt-5-nano`, `gateway-gpt-5-mini`, `gateway-deepseek-v4-flash`
- Premium models return 403 from the Worker
- Merge mode is capped at 4 models and consumes one Worker rate-limit hit because `/api/merge` is handled server-side
- Model catalog fetches (`/api/models`) are **not** rate-limited

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

Important production note: if `VITE_API_BASE` is missing on Pages, the app fails
closed instead of falling back to `unlimited.surf`. Set it to the Worker URL so
the browser never calls the upstream provider directly.

---

## Checklist

- [ ] KV namespace created and ID pasted into `wrangler.toml`
- [ ] `API_KEY` secret stored via `wrangler secret put`
- [ ] Worker deployed with `wrangler deploy`
- [ ] `/api/merge` tested as a single rate-limit hit
- [ ] Pages project connected to GitHub repo
- [ ] `VITE_API_BASE` environment variable set on Pages to the Worker URL
- [ ] Adsterra zone IDs replaced in `AdSlot.tsx`
- [ ] Rewarded callback wired in `RewardAd.tsx`
- [ ] Push to main → Pages auto-deploys
