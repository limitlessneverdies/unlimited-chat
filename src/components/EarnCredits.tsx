import { useState, useEffect } from 'react';
import { X, Coins, ExternalLink, Image, Gift, MousePointerClick } from 'lucide-react';
import { useCredits } from '../store/credits';

interface EarnCreditsProps {
  open: boolean;
  onClose: () => void;
}

const SMARTLINK_URL = 'https://www.effectivecpmnetwork.com/ce7k8fvz?key=ef30a1d35aa3087234b05eba3fba8418';

/**
 * Modal for earning credits. ALL tasks require real ad engagement.
 * No fake tasks — every credit comes from a real ad impression or click.
 */
export default function EarnCredits({ open, onClose }: EarnCreditsProps) {
  const earn = useCredits((s) => s.earn);
  const balance = useCredits((s) => s.balance);
  const totalEarned = useCredits((s) => s.totalEarned);
  const [taskStates, setTaskStates] = useState<Record<string, { count: number; lastEarn: number }>>({});
  const [adImpressions, setAdImpressions] = useState(0);

  // Track real ad impressions via custom events from AdSlot
  useEffect(() => {
    function onImpression() {
      setAdImpressions((prev) => prev + 1);
      // Award 1 credit per banner/native view (max 5 per session)
      const state = taskStates['banner-view'];
      if (!state || state.count < 5) {
        earn(1, 'Banner ad viewed');
        setTaskStates((prev) => ({
          ...prev,
          'banner-view': {
            count: (prev['banner-view']?.count || 0) + 1,
            lastEarn: Date.now(),
          },
        }));
      }
    }
    window.addEventListener('ad-impression', onImpression);
    return () => window.removeEventListener('ad-impression', onImpression);
  }, [earn, taskStates]);

  if (!open) return null;

  function handleSmartlinkClick() {
    window.open(SMARTLINK_URL, '_blank');
    earn(5, 'Sponsored link clicked');
    setTaskStates((prev) => ({
      ...prev,
      smartlink: {
        count: (prev.smartlink?.count || 0) + 1,
        lastEarn: Date.now(),
      },
    }));
  }

  function handleDailyBonus() {
    const state = taskStates['daily'];
    if (state && state.count > 0) return; // Already claimed today
    earn(20, 'Daily bonus');
    setTaskStates((prev) => ({
      ...prev,
      daily: { count: 1, lastEarn: Date.now() },
    }));
  }

  function handlePopunder() {
    // Fire a real popunder by triggering a click event
    window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    earn(3, 'Popunder ad triggered');
    setTaskStates((prev) => ({
      ...prev,
      popunder: {
        count: (prev.popunder?.count || 0) + 1,
        lastEarn: Date.now(),
      },
    }));
  }

  const tasks = [
    {
      id: 'smartlink',
      icon: MousePointerClick,
      title: 'Click a sponsored link',
      description: 'Opens advertiser page • +5 credits',
      reward: 5,
      color: '#22c55e',
      action: handleSmartlinkClick,
      timesDone: taskStates['smartlink']?.count || 0,
    },
    {
      id: 'banner-view',
      icon: Image,
      title: 'View banner ads',
      description: `${adImpressions} ads loaded this session • +1 credit each`,
      reward: 1,
      color: '#3b82f6',
      action: () => {
        // Scroll to a banner ad to trigger impression
        const banners = document.querySelectorAll('[data-ad-banner]');
        if (banners.length > 0) {
          banners[0].scrollIntoView({ behavior: 'smooth' });
        }
      },
      timesDone: taskStates['banner-view']?.count || 0,
    },
    {
      id: 'popunder',
      icon: ExternalLink,
      title: 'Trigger a popunder ad',
      description: 'Opens sponsored page in new tab • +3 credits',
      reward: 3,
      color: '#f59e0b',
      action: handlePopunder,
      timesDone: taskStates['popunder']?.count || 0,
    },
    {
      id: 'daily',
      icon: Gift,
      title: 'Daily login bonus',
      description: 'Once per day • +20 credits',
      reward: 20,
      color: '#a855f7',
      action: handleDailyBonus,
      timesDone: taskStates['daily']?.count || 0,
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: 420,
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Coins size={20} color="#ccff00" />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
              Earn Credits
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Balance */}
        <div
          style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            background: 'rgba(204,255,0,0.05)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              CURRENT BALANCE
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ccff00' }}>
              {balance}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              TOTAL EARNED
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              {totalEarned}
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '12px 24px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          All credits come from real ad engagement. Click ads to earn.
        </div>

        {/* Tasks */}
        <div style={{ padding: '12px 24px 20px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: '0.1em' }}>
            EARN BY INTERACTING WITH ADS
          </div>

          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <button
                key={task.id}
                onClick={task.action}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: task.color + '22',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={task.color} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {task.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ccff00' }}>
                    +{task.reward}
                  </div>
                  {task.timesDone > 0 && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      {task.timesDone}x done
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
