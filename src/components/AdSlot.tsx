import { useEffect, useRef } from 'react';

// Adsterra ad unit IDs from dashboard
export const ADSTERRA = {
  POPUNDER: '29662816',
  SMARTLINK: '29662817',
  SOCIAL_BAR: '29662818',
  NATIVE_BANNER: '29662819',
  BANNER_728x90: '29662820',
} as const;

type AdFormat = 'banner' | 'native' | 'social-bar' | 'popunder' | 'smartlink';

interface AdSlotProps {
  format: AdFormat;
  zoneId?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable Adsterra ad component. Each format gets its own rendering approach.
 */
export default function AdSlot({ format, zoneId, className, style }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Adsterra ads render via their script injection — we just provide the container.
    // The actual rendering happens through the script tags we inject in index.html
    // or via the Adsterra dashboard's embed code.
  }, [format]);

  const zone = zoneId ?? ADSTERRA[format === 'banner' ? 'BANNER_728x90' : format === 'native' ? 'NATIVE_BANNER' : 'SOCIAL_BAR'];

  if (format === 'social-bar') {
    return (
      <div
        ref={ref}
        className={className}
        id={`adsterra-social-bar`}
        data-zone-id={zone}
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999, ...style }}
      />
    );
  }

  if (format === 'banner') {
    return (
      <div
        ref={ref}
        className={className}
        id={`adsterra-banner-${zone}`}
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
        id={`adsterra-native-${zone}`}
        data-zone-id={zone}
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
      id={`adsterra-${format}-${zone}`}
      data-zone-id={zone}
      style={{ minHeight: 60, overflow: 'hidden', ...style }}
    />
  );
}
