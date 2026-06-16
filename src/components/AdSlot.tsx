import { useRef, useEffect, useCallback } from 'react';

type AdFormat = 'banner' | 'banner-mobile' | 'native' | 'smartlink';

interface AdSlotProps {
  format: AdFormat;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Adsterra ad slots. Uses direct script injection for reliable rendering.
 * Listens for 'ad-refresh' events to re-inject scripts (rotate ads).
 */
export default function AdSlot({ format, className, style }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);

  const inject = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';

    if (format === 'banner') {
      const opts = document.createElement('script');
      opts.textContent = `atOptions = { 'key': '04948a5115e4bef52fb55e392603648c', 'format': 'iframe', 'height': 90, 'width': 728, 'params': {} };`;
      el.appendChild(opts);
      const inv = document.createElement('script');
      inv.src = 'https://www.highperformanceformat.com/04948a5115e4bef52fb55e392603648c/invoke.js';
      el.appendChild(inv);
    }

    if (format === 'banner-mobile') {
      const opts = document.createElement('script');
      opts.textContent = `atOptions = { 'key': 'fdf2f15bc9595747b558879d99514218', 'format': 'iframe', 'height': 50, 'width': 320, 'params': {} };`;
      el.appendChild(opts);
      const inv = document.createElement('script');
      inv.src = 'https://www.highperformanceformat.com/fdf2f15bc9595747b558879d99514218/invoke.js';
      el.appendChild(inv);
    }

    if (format === 'native') {
      const container = document.createElement('div');
      container.id = 'container-1a75697c1f9818fcbcb3e565a6e7057f';
      el.appendChild(container);
      const s = document.createElement('script');
      s.src = 'https://pl29763318.effectivecpmnetwork.com/1a75697c1f9818fcbcb3e565a6e7057f/invoke.js';
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      el.appendChild(s);
    }

    if (format === 'smartlink') {
      const a = document.createElement('a');
      a.href = 'https://www.effectivecpmnetwork.com/ce7k8fvz?key=ef30a1d35aa3087234b05eba3fba8418';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Discover more';
      a.style.cssText = 'display:inline-block;padding:10px 20px;background:#ccff00;color:#000;font-weight:700;font-size:13px;border-radius:6px;text-decoration:none;';
      el.appendChild(a);
    }
  }, [format]);

  // Initial inject + refresh listener
  useEffect(() => {
    inject();
    const onRefresh = () => inject();
    window.addEventListener('ad-refresh', onRefresh);
    return () => window.removeEventListener('ad-refresh', onRefresh);
  }, [inject]);

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

  if (format === 'banner-mobile') {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 50,
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

  return (
    <div
      ref={ref}
      className={className}
      style={{ textAlign: 'center', ...style }}
    />
  );
}
