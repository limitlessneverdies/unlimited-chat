import { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';

/**
 * Toast notification that shows when credits are earned.
 * Listens for 'credit-earned' custom events.
 */
export default function CreditToast() {
  const [toasts, setToasts] = useState<{ id: number; amount: number; reason: string }[]>([]);

  useEffect(() => {
    let nextId = 0;
    function onEarned(e: Event) {
      const detail = (e as CustomEvent).detail;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, amount: detail.amount, reason: detail.reason }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }
    window.addEventListener('credit-earned', onEarned);
    return () => window.removeEventListener('credit-earned', onEarned);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: '#1a1a2e',
            border: '1px solid rgba(204,255,0,0.3)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: 'slideInRight 0.3s ease',
          }}
        >
          <Coins size={16} color="#ccff00" />
          <span style={{ color: '#ccff00', fontWeight: 700, fontSize: 14 }}>
            +{t.amount}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            {t.reason}
          </span>
        </div>
      ))}
    </div>
  );
}
