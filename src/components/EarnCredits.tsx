import { useState } from 'react';
import { X, Coins, Video, MousePointerClick, Gift, Zap } from 'lucide-react';
import { useCredits } from '../store/credits';
import AdSlot from './AdSlot';

interface EarnCreditsProps {
  open: boolean;
  onClose: () => void;
}

const TASKS = [
  {
    id: 'video',
    icon: Video,
    title: 'Watch a video ad',
    description: '10 credits',
    reward: 10,
    color: '#3b82f6',
  },
  {
    id: 'click',
    icon: MousePointerClick,
    title: 'Click a sponsored link',
    description: '5 credits',
    reward: 5,
    color: '#22c55e',
  },
  {
    id: 'daily',
    icon: Gift,
    title: 'Daily bonus',
    description: '20 credits',
    reward: 20,
    color: '#a855f7',
  },
];

/**
 * Modal for earning credits. Shows tasks the user can complete to earn credits.
 */
export default function EarnCredits({ open, onClose }: EarnCreditsProps) {
  const earn = useCredits((s) => s.earn);
  const balance = useCredits((s) => s.balance);
  const totalEarned = useCredits((s) => s.totalEarned);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [showVideoAd, setShowVideoAd] = useState(false);

  if (!open) return null;

  function handleTask(taskId: string, reward: number) {
    if (completedTasks.has(taskId)) return;

    if (taskId === 'video') {
      setShowVideoAd(true);
      return;
    }

    earn(reward, taskId === 'daily' ? 'Daily bonus' : 'Sponsored link click');
    setCompletedTasks(new Set([...completedTasks, taskId]));
  }

  function handleVideoComplete() {
    earn(10, 'Video ad watched');
    setCompletedTasks(new Set([...completedTasks, 'video']));
    setShowVideoAd(false);
  }

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

        {/* Tasks */}
        <div style={{ padding: '12px 24px 20px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: '0.1em' }}>
            EARN BY COMPLETING TASKS
          </div>

          {TASKS.map((task) => {
            const Icon = task.icon;
            const completed = completedTasks.has(task.id);
            return (
              <button
                key={task.id}
                onClick={() => handleTask(task.id, task.reward)}
                disabled={completed}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: completed ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: completed ? 'default' : 'pointer',
                  opacity: completed ? 0.5 : 1,
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
                {completed ? (
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                    +{task.reward} ✓
                  </span>
                ) : (
                  <Zap size={14} color="rgba(255,255,255,0.3)" />
                )}
              </button>
            );
          })}
        </div>

        {/* Smartlink ad at bottom */}
        <div style={{ padding: '0 24px 20px' }}>
          <AdSlot format="smartlink" label="🎁 Get 50 bonus credits" />
        </div>
      </div>

      {/* Inline video ad */}
      {showVideoAd && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
          }}
          onClick={handleVideoComplete}
        >
          <div style={{ color: '#fff', fontSize: 14, opacity: 0.6 }}>Advertisement</div>
          <div
            style={{
              width: 320,
              height: 180,
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Video size={48} color="rgba(255,255,255,0.2)" />
          </div>
          <div style={{ color: '#ccff00', fontSize: 13, fontWeight: 600 }}>
            Tap anywhere to continue (+10 credits)
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
            Click to skip • Still earn credits
          </div>
        </div>
      )}
    </div>
  );
}
