import { useEffect, useState, useRef } from 'react';
import { ShieldOff, RefreshCw } from 'lucide-react';

/**
 * Anti-adblock gate. Detects if the user has an ad blocker enabled and
 * blocks the entire app until they disable it. Uses multiple detection
 * methods for reliability.
 */
export default function AdblockGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    detect().then((isBlocked) => {
      setBlocked(isBlocked);
      setChecking(false);
    });

    // Re-check every 3 seconds in case user disables adblocker
    intervalRef.current = setInterval(() => {
      detect().then(setBlocked);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // --- Detection methods ---

  async function detect(): Promise<boolean> {
    // Method 1: Try to load a bait script that ad blockers target
    try {
      const bait = document.createElement('div');
      bait.className = 'ad-banner adbox ads adsbox doubleclick ad-placement';
      bait.style.cssText = 'position:absolute;top:-999px;left:-999px;width:1px;height:1px;';
      bait.innerHTML = '&nbsp;';
      document.body.appendChild(bait);

      await new Promise((r) => setTimeout(r, 100));

      const style = window.getComputedStyle(bait);
      const hidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.height === '0px' ||
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0;

      document.body.removeChild(bait);
      if (hidden) return true;
    } catch {
      // continue to next method
    }

    // Method 2: Try to fetch a known ad script path
    try {
      await fetch('/ads.js', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
      // If the fetch fails or is blocked, adblocker is likely active
    } catch {
      return true;
    }

    // Method 3: Check if Adsterra iframe loaded
    try {
      const iframes = document.querySelectorAll('iframe[src*="effectivecpm"], iframe[src*="highperformanceformat"]');
      if (iframes.length === 0) {
        // Give it a moment — ads may not have loaded yet
        await new Promise((r) => setTimeout(r, 2000));
        const iframes2 = document.querySelectorAll('iframe[src*="effectivecpm"], iframe[src*="highperformanceformat"]');
        if (iframes2.length === 0) return true;
      }
    } catch {
      // continue
    }

    // Method 4: Check for bait element CSS classes being stripped
    try {
      const bait2 = document.createElement('div');
      bait2.id = 'carbonads';
      bait2.style.cssText = 'position:absolute;top:-999px;';
      document.body.appendChild(bait2);
      await new Promise((r) => setTimeout(r, 100));
      if (!document.getElementById('carbonads')) {
        document.body.removeChild(bait2);
        return true;
      }
      document.body.removeChild(bait2);
    } catch {
      // continue
    }

    return false;
  }

  if (checking) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="mono uppercase tiny" style={{ color: 'var(--fg-dim)', letterSpacing: '0.15em', fontSize: 12 }}>
          Checking ad blocker…
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480, padding: 40,
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
          }}
        >
          <ShieldOff size={48} style={{ color: 'var(--danger)', marginBottom: 20 }} />

          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            Ad Blocker Detected
          </h2>

          <p className="dim" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This app is <strong>100% free</strong> and supported by ads.
            <br />
            Please disable your ad blocker to continue using UNLIMITED // CHAT.
          </p>

          <div
            className="mono tiny"
            style={{
              padding: '12px 16px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              fontSize: 11,
              color: 'var(--fg-dim)',
              marginBottom: 24,
              textAlign: 'left',
              lineHeight: 1.8,
            }}
          >
            <strong style={{ color: 'var(--fg)' }}>How to disable:</strong>
            <br />
            1. Click the ad blocker icon in your browser toolbar
            <br />
            2. Select <span style={{ color: 'var(--accent)' }}>"Pause on this site"</span> or <span style={{ color: 'var(--accent)' }}>"Don't run on this site"</span>
            <br />
            3. Refresh this page
          </div>

          <button
            onClick={() => {
              setChecking(true);
              detect().then((isBlocked) => {
                setBlocked(isBlocked);
                setChecking(false);
                if (!isBlocked && intervalRef.current) {
                  clearInterval(intervalRef.current);
                }
              });
            }}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontWeight: 700,
              fontSize: 13,
              borderRadius: 'var(--radius)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={16} />
            I disabled it — check again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
