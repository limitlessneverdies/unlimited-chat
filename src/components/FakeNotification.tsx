import { useState, useEffect } from 'react';
import { X, Bell, Download, AlertTriangle, Gift, MessageSquare } from 'lucide-react';

const SMARTLINK_URL = 'https://www.effectivecpmnetwork.com/ce7k8fvz?key=ef30a1d35aa3087234b05eba3fba8418';

interface NotificationVariant {
  icon: typeof Bell;
  title: string;
  body: string;
  cta: string;
  color: string;
}

const VARIANTS: NotificationVariant[] = [
  {
    icon: Bell,
    title: 'New message received',
    body: 'You have 1 unread message from System',
    cta: 'View message',
    color: '#3b82f6',
  },
  {
    icon: Download,
    title: 'Update available',
    body: 'A new version of Unlimited Chat is ready',
    cta: 'Update now',
    color: '#22c55e',
  },
  {
    icon: AlertTriangle,
    title: 'Storage almost full',
    body: 'Free up space to continue chatting',
    cta: 'Free up space',
    color: '#f59e0b',
  },
  {
    icon: Gift,
    title: 'You won a reward!',
    body: 'Claim your free premium access now',
    cta: 'Claim reward',
    color: '#a855f7',
  },
  {
    icon: MessageSquare,
    title: 'Someone replied',
    body: 'A new reply was posted to your conversation',
    cta: 'See reply',
    color: '#06b6d4',
  },
];

/**
 * Fake notification popup that looks like a system alert.
 * Appears in bottom-right corner, opens an ad when clicked.
 * Shows randomly every 25-45 seconds.
 */
export default function FakeNotification() {
  const [show, setShow] = useState(false);
  const [variant, setVariant] = useState(VARIANTS[0]);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    function scheduleNext() {
      const delay = 25000 + Math.random() * 20000; // 25-45s
      return setTimeout(() => {
        setVariant(VARIANTS[Math.floor(Math.random() * VARIANTS.length)]);
        setShow(true);
        setExiting(false);

        // Auto-dismiss after 8 seconds
        setTimeout(() => {
          setExiting(true);
          setTimeout(() => {
            setShow(false);
            timerRef = scheduleNext();
          }, 400);
        }, 8000);
      }, delay);
    }

    let timerRef = scheduleNext();
    return () => clearTimeout(timerRef);
  }, []);

  if (!show) return null;

  const Icon = variant.icon;

  return (
    <div
      onClick={() => {
        window.open(SMARTLINK_URL, '_blank');
        setExiting(true);
        setTimeout(() => setShow(false), 400);
      }}
      style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        zIndex: 9999,
        width: 320,
        background: '#1a1a2e',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(20px)' : 'translateY(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        animation: 'slideInRight 0.3s ease',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: variant.color + '22',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={variant.color} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
          {variant.title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
          {variant.body}
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: variant.color,
            color: '#fff',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {variant.cta}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExiting(true);
          setTimeout(() => setShow(false), 400);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer',
          padding: 4,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
