import { useEffect, useMemo, useState } from 'react';
import { X, Check, GitMerge, Sparkles } from 'lucide-react';
import { useChat } from '../store/chat';
import { useModels } from '../store/models';
import { MODELS, vendorAccent } from '../api/models';

export default function MergePicker() {
  const open = useChat((s) => s.mergePickerOpen);
  const setOpen = useChat((s) => s.setMergePicker);
  const mergeModels = useChat((s) => s.mergeModels);
  const toggleMergeModel = useChat((s) => s.toggleMergeModel);
  const setMergeModels = useChat((s) => s.setMergeModels);
  const dynamic = useModels((s) => s.models);
  const source = useModels((s) => s.source);
  const [filter, setFilter] = useState('');

  const catalog = useMemo(() => (dynamic.length > 0 ? dynamic : MODELS), [dynamic]);
  const filtered = useMemo(() => {
    if (!filter.trim()) return catalog;
    const q = filter.toLowerCase();
    return catalog.filter((m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.vendor.includes(q));
  }, [catalog, filter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const presets: { label: string; ids: string[] }[] = [
    { label: 'Big 3 flagships', ids: ['claude-opus-4-7-20260101', 'gateway-gpt-5', 'gateway-gemini-2.5-pro'] },
    { label: 'Fast trio',       ids: ['claude-haiku-4', 'gateway-gpt-5-mini', 'gateway-gemini-3-flash'] },
    { label: 'Reasoning duel',  ids: ['claude-opus-4-7-20260101', 'gateway-o3'] },
  ];

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
          width: 640, maxWidth: '92vw',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '78vh',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <GitMerge size={15} style={{ color: 'var(--accent)' }} />
          <div className="mono uppercase tiny" style={{ fontWeight: 700, letterSpacing: '0.15em' }}>MERGE MODE</div>
          <div className="dim" style={{ fontSize: 12 }}>fan out to multiple models in parallel</div>
          <div style={{ flex: 1 }} />
          <span className="mono tiny dimmer">{mergeModels.length} SELECTED · ESC</span>
          <button onClick={() => setOpen(false)} style={{ padding: 4, color: 'var(--fg-dim)' }}><X size={14} /></button>
        </header>

        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, marginBottom: 6 }}>PRESETS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setMergeModels(p.ids.filter((id) => catalog.some((m) => m.id === id)))}
                className="mono tiny"
                style={{
                  padding: '5px 10px',
                  background: 'var(--bg-2)',
                  color: 'var(--fg-dim)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Sparkles size={10} /> {p.label}
              </button>
            ))}
            {mergeModels.length > 0 && (
              <button
                onClick={() => setMergeModels([])}
                className="mono tiny"
                style={{ padding: '5px 10px', color: 'var(--fg-dimmer)', fontSize: 11 }}
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models..."
            autoFocus
            className="mono"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-2)',
              color: 'var(--fg)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <div className="mono tiny dimmer" style={{ fontSize: 9, marginTop: 4 }}>
            CATALOG: {catalog.length} · SOURCE: {source.toUpperCase()} · SHOWING: {filtered.length}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {filtered.map((m) => {
            const selected = mergeModels.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMergeModel(m.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  gap: 10,
                  padding: '8px 10px',
                  textAlign: 'left',
                  background: selected ? 'var(--accent-glow)' : 'transparent',
                  borderRadius: 'var(--radius)',
                  borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
                  alignItems: 'flex-start',
                  marginBottom: 2,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 3,
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--line-2)'}`,
                  background: selected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2, flexShrink: 0,
                }}>
                  {selected && <Check size={11} style={{ color: 'var(--bg)' }} strokeWidth={3} />}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: vendorAccent(m.vendor), marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</span>
                    <span className="mono tiny dimmer">{m.tier}</span>
                  </div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{m.desc}</div>
                </div>
                <span className="mono tiny dimmer" style={{ flexShrink: 0 }}>{m.vendor}</span>
              </button>
            );
          })}
        </div>

        <footer style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)' }}>
          <div className="dim" style={{ fontSize: 11 }}>
            Next message will fan out to {mergeModels.length || 'no'} model{mergeModels.length === 1 ? '' : 's'} in parallel.
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setOpen(false)}
            className="mono uppercase tiny"
            style={{ padding: '8px 14px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 'var(--radius)', fontWeight: 800, fontSize: 11 }}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
