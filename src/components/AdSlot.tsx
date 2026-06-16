import { useEffect, useRef } from 'react';

// Adsterra placeholder zone IDs — replace with real ones from your Adsterra dashboard.
const ZONES: Record<string, string> = {
  sidebar: 'adsterra-sidebar-banner',
  'between-messages': 'adsterra-between-msgs',
};

interface AdSlotProps {
  zone: keyof typeof ZONES;
  className?: string;
}

/**
 * Reusable Adsterra ad surface. Injects the Adsterra script once per page load
 * and renders the zone div. If Adsterra isn't loaded (ad-blocker / SSR), the
 * slot simply collapses to zero height — no layout shift, no console noise.
 */
export default function AdSlot({ zone, className }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject the Adsterra loader script once
    if (!document.getElementById('adsterra-js')) {
      const script = document.createElement('script');
      script.id = 'adsterra-js';
      script.src = 'https://www.adsterra.com/ads.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Tell Adsterra to render inside our container after a tick
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => {
      try {
        (window as any).adsterra?.render(el);
      } catch {
        // Ad-blocked or script not loaded — silently ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={ref}
      data-zone={ZONES[zone]}
      className={className}
      style={{
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
        border: '1px dashed var(--line-2)',
        opacity: 0.6,
      }}
    >
      {/* Fallback text when no ad loads */}
      <span className="mono uppercase tiny dimmer" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
        AD SPACE
      </span>
    </div>
  );
}
