import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { DEFAULT_MODEL } from '../api/models';
import type { SearchSource } from '../api/client';

// --- Per-frame delta batching ---------------------------------------------
// appendDelta accumulates tokens here; scheduleFlush drains them once per rAF
// so fast streams trigger ~60 re-renders/sec instead of one per token.
const pendingDeltas: Record<string, string> = {};
let flushHandle: number | null = null;

function flushDeltas(set: (fn: (s: any) => any) => void) {
  if (flushHandle !== null) {
    cancelAnimationFrame(flushHandle);
    flushHandle = null;
  }
  const ids = Object.keys(pendingDeltas);
  if (ids.length === 0) return;
  const drained: Record<string, string> = { ...pendingDeltas };
  for (const k of ids) delete pendingDeltas[k];
  set((s: any) => {
    const id = s.activeId; if (!id) return s;
    const convo = s.conversations[id]; if (!convo) return s;
    const messages = convo.messages.map((m: any) =>
      drained[m.id] ? { ...m, content: m.content + drained[m.id] } : m,
    );
    return { conversations: { ...s.conversations, [id]: { ...convo, messages } } };
  });
}

function scheduleFlush(set: (fn: (s: any) => any) => void) {
  if (flushHandle !== null) return;
  flushHandle = requestAnimationFrame(() => {
    flushHandle = null;
    flushDeltas(set);
  });
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;          // which model produced this (assistant only)
  createdAt: number;
  streaming?: boolean;
  error?: string;
  sources?: SearchSource[]; // for web-search answers
  pinned?: boolean;
  attachments?: { name: string; size: number }[];
  mergeGroupId?: string;   // set when this assistant msg is one branch of a merge fan-out
}

export interface Conversation {
  id: string;
  title: string;
  autoTitle?: boolean;     // true while the title is auto-generated; a manual rename clears it
  createdAt: number;
  updatedAt: number;
  model: string;
  system?: string;
  messages: Message[];
}

interface ChatState {
  conversations: Record<string, Conversation>;
  order: string[];                 // newest-first conversation IDs
  activeId: string | null;
  model: string;                   // current default model for new chats
  webSearch: boolean;
  effort: 'low' | 'medium' | 'high';
  autoContinue: boolean;
  paletteOpen: boolean;

  // UI panels
  systemEditorOpen: boolean;
  mergePickerOpen: boolean;
  artifactPaneOpen: boolean;
  artifactCode: string | null;
  artifactLang: string | null;

  // Merge mode — when non-empty, send fans out to these models
  mergeModels: string[];

  // Rate limit state (populated when Worker returns 429)
  rateLimit: { message: string; cap: number; used: number } | null;

  // actions
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setTitleIfDefault: (id: string, title: string) => void;

  addUserMessage: (text: string, attachments?: Message['attachments']) => Message | null;
  startAssistant: (model: string, mergeGroupId?: string) => Message | null;
  appendDelta: (msgId: string, delta: string) => void;
  finishAssistant: (msgId: string, err?: string) => void;
  reopenAssistant: (msgId: string) => void;
  setSources: (msgId: string, sources: SearchSource[]) => void;
  togglePin: (msgId: string) => void;
  editUserMessage: (msgId: string, newText: string) => void;

  setModel: (id: string) => void;
  setWebSearch: (b: boolean) => void;
  setEffort: (e: 'low' | 'medium' | 'high') => void;
  setAutoContinue: (b: boolean) => void;
  setPalette: (b: boolean) => void;
  setSystem: (text: string) => void;

  setSystemEditor: (b: boolean) => void;
  setMergePicker: (b: boolean) => void;
  setMergeModels: (ids: string[]) => void;
  toggleMergeModel: (id: string) => void;

  setRateLimit: (rl: { message: string; cap: number; used: number } | null) => void;

  openArtifact: (code: string, lang: string) => void;
  closeArtifact: () => void;
}

function blankConvo(model: string): Conversation {
  const id = nanoid(10);
  const now = Date.now();
  return { id, title: 'New chat', createdAt: now, updatedAt: now, model, messages: [] };
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      order: [],
      activeId: null,
      model: DEFAULT_MODEL,
      webSearch: false,
      effort: 'medium',
      autoContinue: true,
      paletteOpen: false,

      systemEditorOpen: false,
      mergePickerOpen: false,
      artifactPaneOpen: false,
      artifactCode: null,
      artifactLang: null,
      mergeModels: [],

      rateLimit: null,

      newConversation: () => {
        const c = blankConvo(get().model);
        set((s) => ({
          conversations: { ...s.conversations, [c.id]: c },
          order: [c.id, ...s.order],
          activeId: c.id,
        }));
        return c.id;
      },

      selectConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) => set((s) => {
        const { [id]: _, ...rest } = s.conversations;
        const order = s.order.filter((x) => x !== id);
        const activeId = s.activeId === id ? (order[0] ?? null) : s.activeId;
        return { conversations: rest, order, activeId };
      }),

      renameConversation: (id, title) => set((s) => {
        const c = s.conversations[id];
        if (!c) return s;
        // A manual rename pins the title — clear autoTitle so the background
        // smart-title can't overwrite it.
        return { conversations: { ...s.conversations, [id]: { ...c, title, autoTitle: false, updatedAt: Date.now() } } };
      }),

      // Set a generated title only while the title is still auto-generated.
      // A manual rename clears the autoTitle flag, so this won't clobber it.
      setTitleIfDefault: (id, title) => set((s) => {
        const c = s.conversations[id];
        if (!c) return s;
        if (c.autoTitle === false) return s;
        const clean = title.trim().replace(/^["'#\s]+|["'\s]+$/g, '').slice(0, 60);
        if (!clean) return s;
        return { conversations: { ...s.conversations, [id]: { ...c, title: clean, autoTitle: true } } };
      }),

      addUserMessage: (text, attachments) => {
        let { activeId } = get();
        if (!activeId) activeId = get().newConversation();
        const convo = get().conversations[activeId];
        if (!convo) return null;
        const msg: Message = {
          id: nanoid(8),
          role: 'user',
          content: text,
          createdAt: Date.now(),
          attachments,
        };
        const isFirst = convo.messages.length === 0;
        const title = isFirst ? text.slice(0, 60).replace(/\s+/g, ' ').trim() || 'New chat' : convo.title;
        // Mark a first-message title as auto so the background smart-title can
        // overwrite it; a user rename clears the flag (see renameConversation).
        const autoTitle = isFirst ? true : convo.autoTitle;
        set((s) => ({
          conversations: {
            ...s.conversations,
            [activeId!]: { ...convo, title, autoTitle, messages: [...convo.messages, msg], updatedAt: Date.now() },
          },
        }));
        return msg;
      },

      startAssistant: (model, mergeGroupId) => {
        const { activeId } = get();
        if (!activeId) return null;
        const convo = get().conversations[activeId];
        if (!convo) return null;
        const msg: Message = {
          id: nanoid(8),
          role: 'assistant',
          content: '',
          model,
          createdAt: Date.now(),
          streaming: true,
          ...(mergeGroupId ? { mergeGroupId } : {}),
        };
        set((s) => ({
          conversations: {
            ...s.conversations,
            [activeId]: { ...convo, messages: [...convo.messages, msg], updatedAt: Date.now() },
          },
        }));
        return msg;
      },

      appendDelta: (msgId, delta) => {
        // Batch per-frame: accumulate deltas and flush once per rAF so we
        // re-render ~60/sec instead of once per token on fast streams.
        pendingDeltas[msgId] = (pendingDeltas[msgId] ?? '') + delta;
        scheduleFlush(set);
      },

      finishAssistant: (msgId, err) => {
        flushDeltas(set);  // drain any buffered tokens before closing the message
        set((s) => {
          const id = s.activeId; if (!id) return s;
          const convo = s.conversations[id]; if (!convo) return s;
          const messages = convo.messages.map((m) => m.id === msgId ? { ...m, streaming: false, error: err } : m);
          return { conversations: { ...s.conversations, [id]: { ...convo, messages, updatedAt: Date.now() } } };
        });
      },

      reopenAssistant: (msgId) => {
        flushDeltas(set);  // drain any buffered tokens before reopening for a continue
        set((s) => {
          const id = s.activeId; if (!id) return s;
          const convo = s.conversations[id]; if (!convo) return s;
          const messages = convo.messages.map((m) => m.id === msgId ? { ...m, streaming: true, error: undefined } : m);
          return { conversations: { ...s.conversations, [id]: { ...convo, messages } } };
        });
      },

      setSources: (msgId, sources) => set((s) => {
        const id = s.activeId; if (!id) return s;
        const convo = s.conversations[id]; if (!convo) return s;
        const messages = convo.messages.map((m) => m.id === msgId ? { ...m, sources } : m);
        return { conversations: { ...s.conversations, [id]: { ...convo, messages } } };
      }),

      togglePin: (msgId) => set((s) => {
        const id = s.activeId; if (!id) return s;
        const convo = s.conversations[id]; if (!convo) return s;
        const messages = convo.messages.map((m) => m.id === msgId ? { ...m, pinned: !m.pinned } : m);
        return { conversations: { ...s.conversations, [id]: { ...convo, messages } } };
      }),

      editUserMessage: (msgId, newText) => set((s) => {
        const id = s.activeId; if (!id) return s;
        const convo = s.conversations[id]; if (!convo) return s;
        // Truncate everything after the edited message, replace its content
        const idx = convo.messages.findIndex((m) => m.id === msgId);
        if (idx < 0) return s;
        const head = convo.messages.slice(0, idx);
        const edited = { ...convo.messages[idx], content: newText };
        return { conversations: { ...s.conversations, [id]: { ...convo, messages: [...head, edited], updatedAt: Date.now() } } };
      }),

      setModel: (id) => set((s) => {
        // Also update active convo's model so the badge reflects it
        const aId = s.activeId;
        if (aId && s.conversations[aId]) {
          return {
            model: id,
            conversations: { ...s.conversations, [aId]: { ...s.conversations[aId], model: id } },
          };
        }
        return { model: id };
      }),
      setWebSearch: (b) => set({ webSearch: b }),
      setEffort: (e) => set({ effort: e }),
      setAutoContinue: (b) => set({ autoContinue: b }),
      setPalette: (b) => set({ paletteOpen: b }),
      setSystem: (text) => set((s) => {
        const id = s.activeId; if (!id) return s;
        const convo = s.conversations[id]; if (!convo) return s;
        return { conversations: { ...s.conversations, [id]: { ...convo, system: text } } };
      }),

      setSystemEditor: (b) => set({ systemEditorOpen: b }),
      setMergePicker: (b) => set({ mergePickerOpen: b }),
      setMergeModels: (ids) => set({ mergeModels: ids.slice(0, 4) }),
      toggleMergeModel: (id) => set((s) => {
        const has = s.mergeModels.includes(id);
        const next = has
          ? s.mergeModels.filter((x) => x !== id)
          : [...s.mergeModels, id].slice(0, 4);
        return { mergeModels: next };
      }),

      setRateLimit: (rl) => set({ rateLimit: rl }),

      openArtifact: (code, lang) => set({ artifactPaneOpen: true, artifactCode: code, artifactLang: lang }),
      closeArtifact: () => set({ artifactPaneOpen: false, artifactCode: null, artifactLang: null }),
    }),
    {
      name: 'unlimited-chat-v1',
      partialize: (s) => ({
        conversations: s.conversations,
        order: s.order,
        activeId: s.activeId,
        model: s.model,
        webSearch: s.webSearch,
        effort: s.effort,
        autoContinue: s.autoContinue,
        mergeModels: s.mergeModels,
      }),
    },
  ),
);
