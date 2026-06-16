import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MessageSquare, Cpu, Settings as SettingsIcon, Plus, Trash2, Globe } from 'lucide-react';
import { useChat } from '../store/chat';
import { useModels } from '../store/models';
import { MODELS, modelById } from '../api/models';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  section: string;
  run: () => void;
}

export default function CommandPalette() {
  const open = useChat((s) => s.paletteOpen);
  const setOpen = useChat((s) => s.setPalette);
  const conversations = useChat((s) => s.conversations);
  const order = useChat((s) => s.order);
  const newConversation = useChat((s) => s.newConversation);
  const selectConversation = useChat((s) => s.selectConversation);
  const deleteConversation = useChat((s) => s.deleteConversation);
  const setModel = useChat((s) => s.setModel);
  const setWebSearch = useChat((s) => s.setWebSearch);
  const webSearch = useChat((s) => s.webSearch);
  const currentModel = useChat((s) => s.model);
  const dynamic = useModels((s) => s.models);
  const catalog = useMemo(() => (dynamic.length > 0 ? dynamic : MODELS), [dynamic]);

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      {
        id: 'new',
        label: 'New chat',
        hint: '⌘N',
        icon: <Plus size={14} />,
        section: 'Actions',
        run: () => { newConversation(); setOpen(false); },
      },
      {
        id: 'web',
        label: webSearch ? 'Disable web search' : 'Enable web search',
        icon: <Globe size={14} />,
        section: 'Actions',
        run: () => { setWebSearch(!webSearch); setOpen(false); },
      },
    ];

    // Model switchers (dynamic gateway catalog, falling back to static)
    for (const m of catalog) {
      list.push({
        id: `model:${m.id}`,
        label: `Switch to ${m.label}`,
        hint: m.vendor.toUpperCase(),
        icon: <Cpu size={14} style={{ color: m.id === currentModel ? 'var(--accent)' : undefined }} />,
        section: 'Models',
        run: () => { setModel(m.id); setOpen(false); },
      });
    }

    // Recent conversations
    for (const id of order.slice(0, 30)) {
      const c = conversations[id];
      if (!c) continue;
      list.push({
        id: `convo:${id}`,
        label: c.title || 'New chat',
        hint: `${c.messages.length} msgs · ${modelById(c.model, catalog as any)?.label ?? c.model}`,
        icon: <MessageSquare size={14} />,
        section: 'Conversations',
        run: () => { selectConversation(id); setOpen(false); },
      });
    }

    list.push({
      id: 'delete-current',
      label: 'Delete current chat',
      icon: <Trash2 size={14} />,
      section: 'Danger',
      run: () => {
        const a = useChat.getState().activeId;
        if (a && confirm('Delete this chat?')) { deleteConversation(a); setOpen(false); }
      },
    });
    list.push({
      id: 'about',
      label: 'About UNLIMITED // chat',
      icon: <SettingsIcon size={14} />,
      section: 'Info',
      run: () => { setOpen(false); window.open('https://unlimited.surf', '_blank'); },
    });

    return list;
  }, [conversations, order, currentModel, catalog, webSearch, newConversation, selectConversation, deleteConversation, setModel, setWebSearch, setOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q));
  }, [commands, query]);

  // Group by section preserving order
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      if (!map.has(c.section)) map.set(c.section, []);
      map.get(c.section)!.push(c);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Keep cursor in range
  useEffect(() => { setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(filtered.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[cursor]?.run(); }
  }

  if (!open) return null;

  let flatIdx = -1;
  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640, maxWidth: '90vw', maxHeight: '70vh',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px var(--accent-glow)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Search size={16} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search commands, models, conversations…"
            style={{ flex: 1, fontSize: 15, color: 'var(--fg)' }}
          />
          <span className="mono tiny dimmer">ESC</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {filtered.length === 0 && (
            <div className="dim" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>No matches.</div>
          )}
          {grouped.map(([section, cmds]) => (
            <div key={section} style={{ padding: '8px 6px 4px' }}>
              <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, padding: '0 8px 4px', letterSpacing: '0.15em' }}>
                {section}
              </div>
              {cmds.map((c) => {
                flatIdx++;
                const active = flatIdx === cursor;
                return (
                  <button
                    key={c.id}
                    onClick={c.run}
                    onMouseEnter={() => setCursor(flatIdx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 10px',
                      textAlign: 'left', borderRadius: 'var(--radius)',
                      background: active ? 'var(--bg-3)' : 'transparent',
                      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      fontSize: 13, color: active ? 'var(--fg)' : 'var(--fg-dim)',
                    }}
                  >
                    <span style={{ color: active ? 'var(--accent)' : 'var(--fg-dimmer)' }}>{c.icon}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    {c.hint && <span className="mono tiny dimmer">{c.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
