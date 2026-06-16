import { useEffect, useRef, useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';

interface VideoAdProps {
  onComplete: () => void;
  onSkip?: () => void;
  /** Direct video URL or VAST tag URL */
  src?: string;
  /** Seconds before skip button appears */
  skipAfter?: number;
  /** Ad label text */
  label?: string;
}

/**
 * Full-screen video ad overlay. Plays a video ad and calls onComplete when
 * finished (or on skip). Shows a countdown before the skip button appears.
 */
export default function VideoAd({
  onComplete,
  onSkip,
  src,
  skipAfter = 5,
  label = 'Advertisement',
}: VideoAdProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState(skipAfter);
  const [canSkip, setCanSkip] = useState(false);
  const [finished, setFinished] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanSkip(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-play
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      // Autoplay blocked — start muted
      v.muted = true;
      setMuted(true);
    });
  }, []);

  function handleEnd() {
    setFinished(true);
    setTimeout(onComplete, 800);
  }

  function handleSkip() {
    setFinished(true);
    setTimeout(onSkip ?? onComplete, 800);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: finished ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Ad label */}
      <div
        className="mono uppercase tiny"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          fontSize: 10,
          color: '#fff',
          opacity: 0.6,
          letterSpacing: '0.15em',
          zIndex: 2,
        }}
      >
        {label}
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        onEnded={handleEnd}
        muted={muted}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#000',
        }}
      />

      {/* Controls overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          zIndex: 2,
        }}
      >
        {/* Mute toggle */}
        <button
          onClick={() => {
            setMuted(!muted);
            if (videoRef.current) videoRef.current.muted = !muted;
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Skip button */}
        {canSkip ? (
          <button
            onClick={handleSkip}
            style={{
              padding: '10px 24px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            Skip Ad →
          </button>
        ) : (
          <div
            className="mono"
            style={{
              padding: '10px 20px',
              background: 'rgba(0,0,0,0.5)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            Skip in {countdown}s
          </div>
        )}
      </div>

      {/* Close button (top right) */}
      {canSkip && (
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
