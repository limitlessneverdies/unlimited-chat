import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CreditsState {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastDailyBonus: number;
  adsWatched: number;
  messagesSent: number;

  earn: (amount: number, reason: string) => void;
  spend: (amount: number) => boolean;
  canAfford: (cost: number) => boolean;
  getDailyBonus: () => void;
  trackMessage: () => void;
  reset: () => void;
}

const DAILY_BONUS = 20;
const MESSAGE_BONUS = 2; // every 5 messages
const MESSAGE_BONUS_INTERVAL = 5;

export const useCredits = create<CreditsState>()(
  persist(
    (set, get) => ({
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      lastDailyBonus: 0,
      adsWatched: 0,
      messagesSent: 0,

      earn: (amount: number, reason: string) => {
        set((s) => ({
          balance: s.balance + amount,
          totalEarned: s.totalEarned + amount,
        }));
        // Dispatch event for toast
        window.dispatchEvent(
          new CustomEvent('credit-earned', { detail: { amount, reason } })
        );
      },

      spend: (amount: number) => {
        const { balance } = get();
        if (balance < amount) return false;
        set((s) => ({
          balance: s.balance - amount,
          totalSpent: s.totalSpent + amount,
        }));
        return true;
      },

      canAfford: (cost: number) => get().balance >= cost,

      getDailyBonus: () => {
        const { lastDailyBonus, balance } = get();
        const today = Date.now();
        const lastDate = new Date(lastDailyBonus).toISOString().slice(0, 10);
        const todayDate = new Date(today).toISOString().slice(0, 10);

        if (lastDate !== todayDate) {
          set({
            balance: balance + DAILY_BONUS,
            totalEarned: get().totalEarned + DAILY_BONUS,
            lastDailyBonus: today,
          });
          window.dispatchEvent(
            new CustomEvent('credit-earned', {
              detail: { amount: DAILY_BONUS, reason: 'Daily bonus' },
            })
          );
        }
      },

      trackMessage: () => {
        const { messagesSent, balance } = get();
        const newCount = messagesSent + 1;
        if (newCount % MESSAGE_BONUS_INTERVAL === 0) {
          set({
            messagesSent: newCount,
            balance: balance + MESSAGE_BONUS,
            totalEarned: get().totalEarned + MESSAGE_BONUS,
          });
          window.dispatchEvent(
            new CustomEvent('credit-earned', {
              detail: {
                amount: MESSAGE_BONUS,
                reason: `Bonus: ${MESSAGE_BONUS_INTERVAL} messages sent`,
              },
            })
          );
        } else {
          set({ messagesSent: newCount });
        }
      },

      reset: () =>
        set({
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          lastDailyBonus: 0,
          adsWatched: 0,
          messagesSent: 0,
        }),
    }),
    {
      name: 'unlimited-chat-credits',
    }
  )
);
