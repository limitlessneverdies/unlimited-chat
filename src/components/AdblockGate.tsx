import { useEffect, useState, useRef } from 'react';
import { ShieldOff, RefreshCw } from 'lucide-react';

/**
 * Anti-adblock gate. Uses a single reliable detection method:
 * creates a bait div with ad-related CSS classes and checks if the
 * adblocker hides or removes it. No false positives.
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

    intervalRef.current = setInterval(() => {
      detect().then(setBlocked);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function detect(): Promise<boolean> {
    try {
      const bait = document.createElement('div');
      bait.className = 'ad-zone adbox adsbox doubleclick ad-placement pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
      bait.setAttribute('id', 'adsterra-bait');
      bait.style.cssText = 'position:absolute;top:-10px;left:-10px;width:1px;height:1px;overflow:hidden;z-index:-1;';
      bait.innerHTML = '<a href="/adtest" class="ad-link">ad</a>';
      document.body.appendChild(bait);

      await new Promise((r) => setTimeout(r, 200));

      // Check 1: element still exists in DOM (not removed by adblocker)
      if (!document.getElementById('adsterra-bait')) {
        return true;
      }

      // Check 2: element is not hidden via CSS
      const s = window.getComputedStyle(bait);
      const isHidden =
        s.display === 'none' ||
        s.visibility === 'hidden' ||
        s.opacity === '0' ||
        parseInt(s.height) === 0 ||
        parseInt(s.width) === 0;

      // Clean up
      if (bait.parentNode) bait.parentNode.removeChild(bait);

      return isHidden;
    } catch {
      return false;
    }
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
