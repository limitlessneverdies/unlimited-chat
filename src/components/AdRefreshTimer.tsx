import { useEffect } from 'react';

/**
 * Invisible component that refreshes all ad slots every N seconds.
 * Re-injects ad scripts by dispatching a custom event that AdSlot listens to.
 */
export default function AdRefreshTimer({ intervalMs = 30000 }: { intervalMs?: number }) {
  useEffect(() => {
    const t = setInterval(() => {
      // Dispatch refresh event — AdSlot components will re-inject scripts
      window.dispatchEvent(new CustomEvent('ad-refresh'));
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return null;
}
