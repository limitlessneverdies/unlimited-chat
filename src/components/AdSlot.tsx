import { useEffect, useRef } from 'react';

type AdFormat = 'banner' | 'native' | 'smartlink';

interface AdSlotProps {
  format: AdFormat;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders Adsterra ad units using their actual embed codes.
 */
export default function AdSlot({ format, className, style }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (format === 'banner') {
      // Banner 728x90 (29662820)
      el.innerHTML = '';
      const s1 = document.createElement('script');
      s1.textContent = `atOptions = { 'key': '04948a5115e4bef52fb55e392603648c', 'format': 'iframe', 'height': 90, 'width': 728, 'params': {} };`;
      el.appendChild(s1);
      const s2 = document.createElement('script');
      s2.src = 'https://www.highperformanceformat.com/04948a5115e4bef52fb55e392603648c/invoke.js';
      s2.async = true;
      el.appendChild(s2);
    }

    if (format === 'native') {
      // Native Banner (29662819)
      el.innerHTML = '<div id="container-1a75697c1f9818fcbcb3e565a6e7057f"></div>';
      const s = document.createElement('script');
      s.src = 'https://pl29763318.effectivecpmnetwork.com/1a75697c1f9818fcbcb3e565a6e7057f/invoke.js';
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      el.appendChild(s);
    }

    if (format === 'smartlink') {
      // Smartlink (29662817) — rendered as a clickable link
      el.innerHTML = '';
      const a = document.createElement('a');
      a.href = 'https://www.effectivecpmnetwork.com/ce7k8fvz?key=ef30a1d35aa3087234b05eba3fba8418';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Discover more';
      a.style.cssText = 'display:inline-block;padding:10px 20px;background:var(--accent);color:var(--bg);font-weight:700;font-size:13px;border-radius:var(--radius);text-decoration:none;';
      el.appendChild(a);
    }
  }, [format]);

  if (format === 'banner') {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 90,
          ...style,
        }}
      />
    );
  }

  if (format === 'native') {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          minHeight: 80,
          overflow: 'hidden',
          ...style,
        }}
      />
    );
  }

  // smartlink
  return (
    <div
      ref={ref}
      className={className}
      style={{
        textAlign: 'center',
        ...style,
      }}
    />
  );
}
