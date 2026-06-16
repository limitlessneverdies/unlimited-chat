import { useEffect, useRef, useState } from 'react';
import { X, Save, Sparkles, Trash2 } from 'lucide-react';
import { useChat } from '../store/chat';
import { estimateTokens, formatTokens } from '../lib/tokens';

const PRESETS: { label: string; system: string }[] = [
  { label: 'Default', system: '' },
  { label: 'Concise expert', system: 'You are a concise expert. Answer directly, no preamble. Bullet points only when listing 3+ items. Cite your assumptions.' },
  { label: 'Senior engineer', system: 'You are a senior software engineer. Prefer simple, idiomatic solutions. Show working code with brief inline comments. Flag edge cases and security concerns.' },
  { label: 'Brutal critic', system: 'You are a sharp, blunt editor. Cut anything weak. Point out unsupported claims. No hedging. No emoji.' },
  { label: 'Socratic tutor', system: 'You are a Socratic tutor. Ask probing questions before answering. Lead the user to the insight rather than handing it over.' },
  { label: 'Product strategist', system: 'You are a startup product strategist. Frame answers around user value, distribution, and the smallest viable test. Push back on vanity features.' },
];

export default function SystemPromptEditor() {
  const open = useChat((s) => s.systemEditorOpen);
  const setOpen = useChat((s) => s.setSystemEditor);
  const activeId = useChat((s) => s.activeId);
  const convo = useChat((s) => (activeId ? s.conversations[activeId] : null));
  const setSystem = useChat((s) => s.setSystem);
  const [draft, setDraft] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(convo?.system ?? '');
      setTimeout(() => taRef.current?.focus(), 30);
    }
  }, [open, convo?.system]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setSystem(draft.trim());
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, draft, setOpen, setSystem]);

  if (!open) return null;

  function save() { setSystem(draft.trim()); setOpen(false); }
  function clear() { setDraft(''); }

  const tokens = estimateTokens(draft);

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '92vw',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '78vh',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          <div className="mono uppercase tiny" style={{ fontWeight: 700, letterSpacing: '0.15em' }}>SYSTEM PROMPT</div>
          <div className="dim" style={{ fontSize: 12 }}>steers this conversation only</div>
          <div style={{ flex: 1 }} />
          <span className="mono tiny dimmer">{formatTokens(tokens)} TOK · CTRL+ENTER TO SAVE · ESC</span>
          <button onClick={() => setOpen(false)} style={{ padding: 4, color: 'var(--fg-dim)' }}><X size={14} /></button>
        </header>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, marginBottom: 6 }}>PRESETS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setDraft(p.system)}
                className="mono tiny"
                style={{
                  padding: '5px 10px',
                  background: draft === p.system ? 'var(--accent-glow)' : 'var(--bg-2)',
                  color: draft === p.system ? 'var(--accent)' : 'var(--fg-dim)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  fontSize: 11,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe the assistant's voice, role, constraints, or output format..."
          style={{
            flex: 1, minHeight: 240,
            padding: '14px 16px',
            background: 'transparent',
            color: 'var(--fg)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.55,
            border: 'none',
            outline: 'none',
            resize: 'none',
          }}
        />

        <footer style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)' }}>
          <button
            onClick={clear}
            className="mono uppercase tiny"
            style={{ padding: '8px 12px', color: 'var(--fg-dim)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 10 }}
          >
            <Trash2 size={11} /> Clear
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setOpen(false)} className="mono uppercase tiny" style={{ padding: '8px 12px', color: 'var(--fg-dim)', fontWeight: 700, fontSize: 10 }}>Cancel</button>
          <button
            onClick={save}
            className="mono uppercase tiny"
            style={{ padding: '8px 14px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 11 }}
          >
            <Save size={11} /> Save system
          </button>
        </footer>
      </div>
    </div>
  );
}
