import { useState } from 'react';
import { PlayCircle, CheckCircle, X } from 'lucide-react';
import AdSlot from './AdSlot';

interface RewardAdProps {
  message: string;
  cap: number;
  used: number;
  onDismiss: () => void;
  onUnlock?: () => void;
  onRetry?: () => void;
}

/**
 * Shown when the Worker returns a 429 (daily limit reached). Offers the user
 * the option to "watch an ad" to unlock more requests. For v1, clicking
 * "Watch Ad" simply resets the local cooldown and re-enables sending — the
 * actual ad integration can be hooked up later via Adsterra's rewarded video
 * API.
 */
export default function RewardAd({ message, cap, used, onDismiss, onUnlock, onRetry }: RewardAdProps) {
  const [watching, setWatching] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  function handleWatch() {
    setWatching(true);
    // Simulate a 3-second rewarded ad. Replace with real Adsterra rewarded
    // video callback when ready.
    setTimeout(() => {
      setWatching(false);
      setUnlocked(true);
      onUnlock?.();
      // Auto-dismiss after a short celebration
      setTimeout(onDismiss, 1800);
    }, 3000);
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '40px auto',
        padding: 28,
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={onDismiss} style={{ color: 'var(--fg-dimmer)', padding: 4 }}>
          <X size={14} />
        </button>
      </div>

      <div className="mono uppercase tiny dimmer" style={{ fontSize: 10, marginBottom: 12, letterSpacing: '0.15em' }}>
        DAILY LIMIT REACHED
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        {used} / {cap}
      </div>
      <p className="dim" style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
        {message}
      </p>

      {unlocked ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)' }}>
            <CheckCircle size={18} />
            <span className="mono uppercase" style={{ fontWeight: 700, fontSize: 13 }}>Unlocked!</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '10px 18px',
                background: 'var(--bg-2)',
                color: 'var(--fg)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Retry now
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleWatch}
          disabled={watching}
          style={{
            padding: '12px 24px',
            background: watching ? 'var(--bg-3)' : 'var(--accent)',
            color: watching ? 'var(--fg-dim)' : 'var(--bg)',
            fontWeight: 700,
            fontSize: 13,
            borderRadius: 'var(--radius)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            opacity: watching ? 0.7 : 1,
          }}
        >
          <PlayCircle size={16} />
          {watching ? 'Watching…' : 'Watch Ad to Unlock'}
        </button>
      )}

      <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, marginTop: 16, letterSpacing: '0.1em' }}>
        Resets automatically at midnight UTC
      </div>

      {/* Smartlink ad */}
      <div style={{ marginTop: 20 }}>
        <AdSlot format="smartlink" zoneId="29662817" />
      </div>
    </div>
  );
}
