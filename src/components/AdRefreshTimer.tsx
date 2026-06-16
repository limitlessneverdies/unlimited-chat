/**
 * Ad refresh timer — DISABLED.
 * Ads load once on mount. Destroying/recreating iframes every 30s
 * kills impressions, causes flicker, and triggers ad-blocker detection.
 * Keeping this component as a no-op for backwards compatibility.
 */
export default function AdRefreshTimer() {
  return null;
}
