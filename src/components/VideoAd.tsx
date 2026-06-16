import { useEffect, useRef, useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';
import { useCredits } from '../store/credits';

interface VideoAdProps {
  onComplete: () => void;
  onSkip?: () => void;
  /** Direct video .mp4 URL */
  src?: string;
  /** VAST tag URL (from Adsterra) — takes priority over src */
  vastUrl?: string;
  /** Seconds before skip button appears */
  skipAfter?: number;
  /** Ad label text */
  label?: string;
}

/**
 * Full-screen video ad overlay. Supports direct .mp4 files and VAST tags.
 * When vastUrl is provided, uses the @arte/videojs-vast plugin.
 */
export default function VideoAd({
  onComplete,
  onSkip,
  src,
  vastUrl,
  skipAfter = 5,
  label = 'Advertisement',
}: VideoAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState(skipAfter);
  const [canSkip, setCanSkip] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState(false);
  const earn = useCredits((s) => s.earn);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      setCanSkip(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Initialize Video.js player
  useEffect(() => {
    if (!containerRef.current || playerRef.current) return;

    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-big-play-centered';
    containerRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      controls: false,
      autoplay: true,
      preload: 'auto',
      fill: true,
      playsinline: true,
      muted: false,
    });

    playerRef.current = player;

    if (vastUrl) {
      // Load VAST tag
      import('@arte/videojs-vast').then(() => {
        (player as any).vast({ vastUrl });
      }).catch(() => {
        // VAST plugin failed — fall back to direct src
        if (src) player.src({ type: 'video/mp4', src });
      });
    } else if (src) {
      player.src({ type: 'video/mp4', src });
    } else {
      // No source — show error state
      setError(true);
    }

    player.on('ended', () => {
      earn(10, 'Video ad completed');
      setFinished(true);
      setTimeout(onComplete, 800);
    });

    player.on('error', () => {
      setError(true);
    });

    // Try autoplay, fallback to muted
    player.ready(() => {
      player.play()?.catch?.(() => {
        player.muted(true);
        setMuted(true);
      });
    });

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  function handleMuteToggle() {
    const p = playerRef.current;
    if (!p) return;
    const newMuted = !muted;
    p.muted(newMuted);
    setMuted(newMuted);
  }

  function handleSkip() {
    earn(3, 'Video ad skipped');
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

      {/* Video container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* Error state — no video source */}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.5 }}>No ad available</div>
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
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Controls overlay */}
      {!error && (
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
            onClick={handleMuteToggle}
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
      )}

      {/* Close button */}
      {canSkip && !error && (
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
