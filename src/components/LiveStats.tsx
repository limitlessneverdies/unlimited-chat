import { useState, useEffect } from 'react';
import { Users, Activity } from 'lucide-react';
import { API_BASE } from '../api/client';

interface Stats {
  active: number;
  total: number;
  promptsToday: number;
}

/**
 * Live stats banner showing active users, total users, and prompts today.
 * Fetches from /api/stats every 10 seconds.
 */
export default function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          if (mounted) setStats(data);
        }
      } catch {
        // silently fail
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Send heartbeat every 30s
  useEffect(() => {
    async function heartbeat() {
      try {
        await fetch(`${API_BASE}/api/heartbeat`, { method: 'POST' });
      } catch {
        // silently fail
      }
    }
    heartbeat();
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e',
          }}
        />
        <Users size={12} />
        <span>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{stats.active}</span> online
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Activity size={12} />
        <span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{stats.total}</span> total users
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>
          <span style={{ color: '#ccff00', fontWeight: 600 }}>{stats.promptsToday}</span> prompts today
        </span>
      </div>
    </div>
  );
}
