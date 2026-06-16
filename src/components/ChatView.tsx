import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useModels } from '../store/models';
import { modelById, MODELS, vendorAccent, isFreeModel, creditCost } from '../api/models';
import { streamChat, streamSearch, streamMerge, generateTitle, RateLimitError } from '../api/client';
import { useCredits } from '../store/credits';
import MessageList from './MessageList';
import Composer from './Composer';
import RewardAd from './RewardAd';
import AdSlot from './AdSlot';
import VideoAd from './VideoAd';
import LiveStats from './LiveStats';
import { VIDEO_AD_CONFIG } from '../config/ads';
import { ChevronDown, Globe, Zap, Sparkles, GitMerge, Download, Infinity as InfinityIcon } from 'lucide-react';
import { nanoid } from 'nanoid';

export default function ChatView() {
  const activeId = useChat((s) => s.activeId);
  const convo = useChat((s) => (activeId ? s.conversations[activeId] : null));
  const model = useChat((s) => s.model);
  const setModel = useChat((s) => s.setModel);
  const webSearch = useChat((s) => s.webSearch);
  const setWebSearch = useChat((s) => s.setWebSearch);
  const effort = useChat((s) => s.effort);
  const setEffort = useChat((s) => s.setEffort);
  const autoContinue = useChat((s) => s.autoContinue);
  const setAutoContinue = useChat((s) => s.setAutoContinue);
  const setSystemEditor = useChat((s) => s.setSystemEditor);
  const setMergePicker = useChat((s) => s.setMergePicker);
  const mergeModels = useChat((s) => s.mergeModels);
  const setMergeModels = useChat((s) => s.setMergeModels);
  const rateLimit = useChat((s) => s.rateLimit);
  const setRateLimit = useChat((s) => s.setRateLimit);
  const credits = useCredits((s) => s.balance);
  const spendCredits = useCredits((s) => s.spend);
  const trackMessage = useCredits((s) => s.trackMessage);
  const [modelOpen, setModelOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [showVideoAd, setShowVideoAd] = useState(false);
  const msgCountRef = useRef(0);

  const dynamic = useModels((s) => s.models);
  const modelsSource = useModels((s) => s.source);
  const catalog = useMemo(() => (dynamic.length > 0 ? dynamic : MODELS), [dynamic]);
  const modelDef = modelById(model, catalog as any) ?? modelById(model);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSend(text: string, attachments?: { name: string; size: number; text: string }[]) {
    if (!text.trim() && !(attachments && attachments.length)) return;
    const store = useChat.getState();

    // Compose the user message — append extracted attachment text inline
    let composed = text;
    if (attachments && attachments.length) {
      const blocks = attachments
        .map((a) => `\n\n--- ATTACHMENT: ${a.name} (${a.size} bytes) ---\n${a.text}\n--- END ATTACHMENT ---`)
        .join('');
      composed = text + blocks;
    }

    const userMsg = store.addUserMessage(composed, attachments?.map((a) => ({ name: a.name, size: a.size })));
    if (!userMsg) return;

    // Credit check for Pro models
    const cost = creditCost(model);
    if (cost > 0 && !spendCredits(cost)) {
      // Not enough credits — show earn modal
      window.dispatchEvent(new CustomEvent('open-earn-credits'));
      return;
    }

    // Track message for bonus credits
    trackMessage();

    // Video ad every N messages
    msgCountRef.current++;
    if (msgCountRef.current % VIDEO_AD_CONFIG.everyNMessages === 0) {
      setShowVideoAd(true);
      return; // Ad shows, user sends message after ad closes
    }

    // Capture before the stream — convo can change underneath us. We trigger a
    // background title generation only on the first exchange of a chat.
    const convoId = useChat.getState().activeId!;
    const isFirstExchange =
      (useChat.getState().conversations[convoId]?.messages.filter((m) => m.role === 'user').length ?? 0) === 1;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);

    try {
      // === MERGE MODE: fan out to N models in parallel ===
      if (mergeModels.length > 0) {
        const groupId = nanoid(8);
        const created: Record<string, string> = {};
        for (const m of mergeModels) {
          const a = store.startAssistant(m, groupId);
          if (a) created[m] = a.id;
        }
        await streamMerge({
          prompt: composed,
          system: useChat.getState().conversations[convoId]?.system,
          models: mergeModels,
          signal: ctrl.signal,
          onDelta: (mid, d) => {
            const id = created[mid];
            if (id) useChat.getState().appendDelta(id, d);
          },
          onDone: (mid, err) => {
            const id = created[mid];
            if (id) useChat.getState().finishAssistant(id, err);
          },
        });
        return;
      }

      // === SINGLE MODEL ===
      const asst = store.startAssistant(model);
      if (!asst) return;
      if (webSearch) {
        await streamSearch({
          query: text,
          model,
          effort,
          signal: ctrl.signal,
          onSources: (s) => store.setSources(asst.id, s),
          onDelta: (d) => store.appendDelta(asst.id, d),
          onDone: () => store.finishAssistant(asst.id),
          onError: (e) => {
            if (e instanceof RateLimitError) setRateLimit({ message: e.message, cap: e.cap, used: e.used });
            store.finishAssistant(asst.id, e.message);
          },
        });
      } else {
        await streamSingle(asst.id, model, ctrl);
      }

      // Background auto-title on the first exchange — never blocks the UI and
      // never clobbers a manually-renamed chat (setTitleIfDefault guards that).
      if (isFirstExchange) {
        const finalConvo = useChat.getState().conversations[convoId];
        const assistantMsg = finalConvo?.messages.filter((m) => m.role === 'assistant' && !m.error).slice(-1)[0];
        if (assistantMsg && assistantMsg.content.trim()) {
          generateTitle(text, assistantMsg.content)
            .then((title) => useChat.getState().setTitleIfDefault(convoId, title))
            .catch(() => { /* fallback already handled inside generateTitle */ });
        }
      }
    } catch (err: any) {
      if (err instanceof RateLimitError) {
        setRateLimit({ message: err.message, cap: err.cap, used: err.used });
        return;
      }
      throw err;
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function exportMarkdown() {
    if (!convo) return;
    const lines: string[] = [];
    lines.push(`# ${convo.title}`);
    lines.push(`*${new Date(convo.createdAt).toISOString()}*`);
    if (convo.system) lines.push(`\n> **System:** ${convo.system}`);
    lines.push('');
    for (const m of convo.messages) {
      const who = m.role === 'user'
        ? 'You'
        : (modelById(m.model || '', catalog as any)?.label ?? m.model ?? 'Assistant');
      lines.push(`## ${who}`);
      lines.push('');
      lines.push(m.content);
      if (m.sources && m.sources.length) {
        lines.push('');
        lines.push('**Sources:**');
        m.sources.forEach((s, i) => lines.push(`${i + 1}. [${s.title || s.url}](${s.url})`));
      }
      lines.push('');
    }
    downloadBlob(`${slug(convo.title)}.md`, lines.join('\n'), 'text/markdown');
  }

  function exportJson() {
    if (!convo) return;
    downloadBlob(`${slug(convo.title)}.json`, JSON.stringify(convo, null, 2), 'application/json');
  }

  function downloadBlob(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'conversation';
  }

  // Build chat history (excluding a given message id and any errored msgs).
  // Merge-fanout siblings (same mergeGroupId) are collapsed to a single
  // representative assistant turn — the longest non-errored answer — so the
  // role sequence stays alternating instead of user→assistant×N→user.
  function buildHistory(excludeId?: string) {
    const c = useChat.getState().conversations[activeId!];
    if (!c) return [];
    const out: { role: 'user' | 'assistant'; content: string }[] = [];
    const seenGroups = new Set<string>();
    for (const m of c.messages) {
      if (m.id === excludeId || m.error) continue;
      if (m.mergeGroupId) {
        if (seenGroups.has(m.mergeGroupId)) continue;
        seenGroups.add(m.mergeGroupId);
        const best = c.messages
          .filter((x) => x.mergeGroupId === m.mergeGroupId && x.id !== excludeId && !x.error)
          .reduce<typeof m | null>((acc, x) => (!acc || x.content.length > acc.content.length ? x : acc), null);
        if (best) out.push({ role: 'assistant', content: best.content });
        continue;
      }
      out.push({ role: m.role, content: m.content });
    }
    return out;
  }

  // Stream one model into an existing assistant message, with optional
  // auto-continue when the model truncates at max_tokens.
  async function streamSingle(asstId: string, useModel: string, ctrl: AbortController) {
    const MAX_ROUNDS = 4;
    let round = 0;
    let stop: string | undefined;

    do {
      const continuing = round > 0;
      const history = buildHistory(asstId);
      if (continuing) {
        // Feed the partial answer back and ask it to keep going seamlessly.
        // Read fresh state — `store` snapshots go stale after each appendDelta.
        const partial = useChat.getState().conversations[activeId!]?.messages.find((m) => m.id === asstId)?.content ?? '';
        history.push({ role: 'assistant', content: partial });
        history.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything. Do not preface.' });
      }
      stop = undefined;
      await streamChat({
        model: useModel,
        messages: history,
        system: useChat.getState().conversations[activeId!]?.system,
        signal: ctrl.signal,
        onDelta: (d) => useChat.getState().appendDelta(asstId, d),
        onDone: (sr) => { stop = sr; },
        onError: (e) => {
          if (e instanceof RateLimitError) setRateLimit({ message: e.message, cap: e.cap, used: e.used });
          stop = 'error';
          useChat.getState().finishAssistant(asstId, e.message);
        },
      });
      round++;
    } while (
      autoContinue &&
      stop === 'max_tokens' &&
      round < MAX_ROUNDS &&
      !ctrl.signal.aborted
    );

    if (stop !== 'error') useChat.getState().finishAssistant(asstId);
  }

  // Manually continue a truncated assistant message from its action button.
  async function handleContinue(messageId: string) {
    if (!convo || streaming) return;
    const target = convo.messages.find((m) => m.id === messageId);
    if (!target || target.role !== 'assistant') return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    const store = useChat.getState();
    store.reopenAssistant(messageId);
    try {
      const history = buildHistory(messageId);
      history.push({ role: 'assistant', content: target.content });
      history.push({ role: 'user', content: 'Continue exactly where you left off. Do not repeat anything. Do not preface.' });
      await streamChat({
        model: target.model || model,
        messages: history,
        system: useChat.getState().conversations[activeId!]?.system,
        signal: ctrl.signal,
        onDelta: (d) => useChat.getState().appendDelta(messageId, d),
        onDone: () => useChat.getState().finishAssistant(messageId),
        onError: (e) => {
          if (e instanceof RateLimitError) setRateLimit({ message: e.message, cap: e.cap, used: e.used });
          useChat.getState().finishAssistant(messageId, e.message);
        },
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      {/* Header */}
      <header
        style={{
          height: 56,
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        {/* Model picker button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setModelOpen((o) => !o)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-2)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--accent)' }}>●</span>
            <span>{modelDef?.label ?? model}</span>
            <span className="dimmer mono" style={{ fontSize: 10 }}>
              {modelDef?.vendor.toUpperCase()}
            </span>
            <ChevronDown size={12} style={{ transform: modelOpen ? 'rotate(180deg)' : '', transition: 'transform 0.15s' }} />
          </button>
          {modelOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: 360,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--radius)',
                padding: 4,
                zIndex: 100,
                boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
            >
              <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>CATALOG · {catalog.length}</span>
                <span>·</span>
                <span>SOURCE: {modelsSource.toUpperCase()}</span>
              </div>
              {catalog.map((m) => {
                const active = m.id === model;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setModelOpen(false); }}
                    style={{
                      display: 'flex',
                      width: '100%',
                      gap: 10,
                      padding: '10px 10px',
                      textAlign: 'left',
                      background: active ? 'var(--bg-3)' : 'transparent',
                      borderRadius: 'var(--radius)',
                      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      alignItems: 'flex-start',
                    }}
                    onMouseEnter={(e) => !active && (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: vendorAccent(m.vendor), marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</span>
                        {!isFreeModel(m.id) && (
                          <span className="mono tiny" style={{ padding: '1px 5px', background: credits >= creditCost(m.id) ? 'rgba(204,255,0,0.15)' : 'rgba(255,60,60,0.15)', color: credits >= creditCost(m.id) ? '#ccff00' : '#ff3c3c', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>
                            {creditCost(m.id)} CR
                          </span>
                        )}
                        {isFreeModel(m.id) && (
                          <span className="mono tiny" style={{ padding: '1px 5px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>
                            FREE
                          </span>
                        )}
                        <span className="mono tiny dimmer">{m.tier}</span>
                      </div>
                      <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{m.desc}</div>
                    </div>
                    <span className="mono tiny dimmer" style={{ flexShrink: 0 }}>{m.vendor}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Web search toggle */}
        <button
          onClick={() => setWebSearch(!webSearch)}
          style={{
            padding: '8px 10px',
            background: webSearch ? 'var(--accent)' : 'var(--bg-2)',
            color: webSearch ? 'var(--bg)' : 'var(--fg-dim)',
            border: `1px solid ${webSearch ? 'var(--accent)' : 'var(--line-2)'}`,
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
          title="Toggle live web search"
        >
          <Globe size={13} />
          Web
        </button>

        {/* Effort */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-2)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          {(['low', 'medium', 'high'] as const).map((e) => (
            <button
              key={e}
              onClick={() => setEffort(e)}
              className="mono uppercase tiny"
              style={{
                padding: '8px 10px',
                background: effort === e ? 'var(--bg-3)' : 'transparent',
                color: effort === e ? 'var(--accent)' : 'var(--fg-dim)',
                fontWeight: 700,
                fontSize: 10,
              }}
            >
              {e === 'low' && '·'}{e === 'medium' && '··'}{e === 'high' && '···'} {e}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Auto-continue toggle */}
        <button
          onClick={() => setAutoContinue(!autoContinue)}
          title="Auto-continue truncated responses (resumes on max_tokens)"
          className="mono uppercase tiny"
          style={{
            padding: '8px 10px',
            background: autoContinue ? 'var(--accent-glow)' : 'var(--bg-2)',
            color: autoContinue ? 'var(--accent)' : 'var(--fg-dim)',
            border: `1px solid ${autoContinue ? 'var(--accent)' : 'var(--line-2)'}`,
            borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700,
          }}
        >
          <InfinityIcon size={13} />
          AUTO
        </button>


        {/* Merge mode indicator (when selected) */}
        {mergeModels.length > 0 && (
          <button
            onClick={() => setMergeModels([])}
            title="Clear merge selection"
            className="mono uppercase tiny"
            style={{
              padding: '6px 10px',
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, fontWeight: 700,
            }}
          >
            <GitMerge size={11} />
            MERGE · {mergeModels.length}
          </button>
        )}

        {/* Merge picker */}
        <button
          onClick={() => setMergePicker(true)}
          title="Merge mode — fan out to multiple models"
          style={{
            padding: '8px 10px',
            background: 'var(--bg-2)',
            color: 'var(--fg-dim)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
          }}
        >
          <GitMerge size={13} />
        </button>

        {/* System prompt */}
        <button
          onClick={() => setSystemEditor(true)}
          title="Edit system prompt"
          style={{
            padding: '8px 10px',
            background: convo?.system ? 'var(--accent-glow)' : 'var(--bg-2)',
            color: convo?.system ? 'var(--accent)' : 'var(--fg-dim)',
            border: `1px solid ${convo?.system ? 'var(--accent)' : 'var(--line-2)'}`,
            borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
          }}
        >
          <Sparkles size={13} />
        </button>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            title="Export conversation"
            style={{
              padding: '8px 10px',
              background: 'var(--bg-2)',
              color: 'var(--fg-dim)',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            }}
          >
            <Download size={13} />
          </button>
          {exportOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 200,
                background: 'var(--bg-1)',
                border: '1px solid var(--line-2)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                padding: 4,
                zIndex: 100,
              }}
            >
              <button
                onClick={() => { exportMarkdown(); setExportOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--fg)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Export as Markdown
              </button>
              <button
                onClick={() => { exportJson(); setExportOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--fg)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Export as JSON
              </button>
            </div>
          )}
        </div>

        {convo && (
          <div className="mono uppercase tiny dimmer" style={{ fontSize: 10 }}>
            <Zap size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {convo.messages.length} msgs
          </div>
        )}

        {/* Live stats */}
        <LiveStats />
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Banner ad at top of chat */}
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'center' }}>
          <AdSlot format="banner" />
        </div>

        {rateLimit ? (
          <RewardAd
            message={rateLimit.message}
            cap={rateLimit.cap}
            used={rateLimit.used}
            onDismiss={() => setRateLimit(null)}
            onUnlock={() => setRateLimit(null)}
          />
        ) : convo && convo.messages.length === 0 ? (
          <EmptyState onPick={(prompt) => handleSend(prompt)} />
        ) : (
          <MessageList onContinue={handleContinue} />
        )}
      </div>

      {/* Composer */}
      <Composer onSend={handleSend} onStop={handleStop} streaming={streaming} />

      {/* Sticky mobile banner — below composer */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px', borderTop: '1px solid var(--line)' }}>
        <AdSlot format="banner-mobile" />
      </div>

      {/* Video Ad — shown every 5 messages */}
      {showVideoAd && (
        <VideoAd
          onComplete={() => setShowVideoAd(false)}
          onSkip={() => setShowVideoAd(false)}
          vastUrl={VIDEO_AD_CONFIG.vastUrl || undefined}
          src={VIDEO_AD_CONFIG.src || undefined}
          skipAfter={VIDEO_AD_CONFIG.skipAfter}
        />
      )}
    </main>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const suggestions = [
    { tag: 'WRITE',   prompt: 'Write a tight one-paragraph product launch announcement for a brutalist-styled AI chat app.' },
    { tag: 'CODE',    prompt: 'Show me a minimal React hook that streams Server-Sent Events with abort support.' },
    { tag: 'EXPLAIN', prompt: 'Explain Kaprekar\'s constant and why every 3-digit number lands on 495.' },
    { tag: 'PLAN',    prompt: 'Help me plan a focused 90-minute deep-work session for a tough coding problem.' },
  ];
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        gap: 32,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          className="mono uppercase tiny dimmer"
          style={{ fontSize: 10, marginBottom: 16, letterSpacing: '0.2em' }}
        >
          UNLIMITED // CHAT
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 0.95,
            margin: 0,
          }}
        >
          Ask <span style={{ color: 'var(--accent)' }}>anything.</span>
          <br />
          <span className="dim">Pick any model.</span>
        </h1>
        <p className="dim" style={{ marginTop: 16, fontSize: 14, maxWidth: 460 }}>
          One key, every model. ⌘K for commands. ⌘N for a new chat. Drop files to attach.
        </p>
      </div>

      {/* Banner ad in empty state */}
      <AdSlot format="banner" style={{ maxWidth: 728 }} />

      {/* Smartlink in empty state — disguised as real button */}
      <AdSlot format="smartlink" label="⚡ Unlock Free Models" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(200px, 280px))',
          gap: 8,
          width: '100%',
          maxWidth: 600,
        }}
      >
        {suggestions.map((s) => (
          <button
            key={s.tag}
            onClick={() => onPick(s.prompt)}
            style={{
              padding: '14px 16px',
              background: 'var(--bg-1)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
              transition: 'border-color 0.12s ease, transform 0.08s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
          >
            <div className="mono uppercase tiny accent" style={{ fontSize: 10, marginBottom: 6 }}>{s.tag}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-dim)', lineHeight: 1.4 }}>{s.prompt}</div>
          </button>
        ))}
      </div>

      {/* Native ad at bottom of empty state */}
      <AdSlot format="native" style={{ maxWidth: 500, width: '100%' }} />
    </div>
  );
}
