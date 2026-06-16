/**
 * Video ad configuration.
 *
 * To use a VAST tag from Adsterra:
 *   1. Contact Adsterra support via live chat
 *   2. Request a VAST tag for your website
 *   3. Paste the VAST URL below as `vastUrl`
 *
 * To use a direct video file:
 *   1. Upload a .mp4 to any CDN (Cloudflare R2, S3, etc.)
 *   2. Paste the direct URL below as `src`
 *
 * If both are set, `vastUrl` takes priority.
 */
export const VIDEO_AD_CONFIG = {
  /** VAST tag URL from Adsterra (paste yours here) */
  vastUrl: '',

  /** Direct .mp4 URL (fallback if no VAST tag) */
  src: '',

  /** Show video ad every N messages */
  everyNMessages: 5,

  /** Seconds before skip button appears */
  skipAfter: 5,
};
