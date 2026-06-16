import { useState } from 'react';
import { Plus, MessageSquare, Trash2, Pin, Settings } from 'lucide-react';
import { useChat } from '../store/chat';
import { useModels } from '../store/models';
import { MODELS, modelById } from '../api/models';
import AdSlot from './AdSlot';

export default function Sidebar() {
  const order = useChat((s) => s.order);
  const conversations = useChat((s) => s.conversations);
  const activeId = useChat((s) => s.activeId);
  const newConversation = useChat((s) => s.newConversation);
  const selectConversation = useChat((s) => s.selectConversation);
  const deleteConversation = useChat((s) => s.deleteConversation);
  const model = useChat((s) => s.model);
  const dynamic = useModels((s) => s.models);
  const [hover, setHover] = useState<string | null>(null);

  const catalog = dynamic.length > 0 ? dynamic : MODELS;
  const modelDef = modelById(model, catalog as any);

  return (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        height: '100%',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--line)',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            background: 'var(--accent)',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 4,
              background: 'var(--bg-1)',
            }}
          />
        </div>
        <div className="mono uppercase tiny" style={{ fontWeight: 700, letterSpacing: '0.15em' }}>
          UNLIMITED<span style={{ color: 'var(--accent)' }}>//</span>CHAT
        </div>
      </div>

      {/* New chat */}
      <button
        onClick={() => newConversation()}
        style={{
          margin: 12,
          padding: '10px 12px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 'var(--radius)',
          transition: 'transform 0.08s ease',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <Plus size={14} strokeWidth={3} />
        New chat
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.55 }}>⌘N</span>
      </button>

      {/* Search palette trigger */}
      <button
        onClick={() => useChat.getState().setPalette(true)}
        className="mono"
        style={{
          margin: '0 12px 8px',
          padding: '8px 10px',
          fontSize: 11,
          color: 'var(--fg-dim)',
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 'var(--radius)',
          textAlign: 'left',
        }}
      >
        <span style={{ opacity: 0.6 }}>Search & commands…</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>⌘K</span>
      </button>

      {/* Convo list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
        <div className="mono uppercase tiny dimmer" style={{ padding: '8px 8px 6px', fontSize: 10 }}>
          Conversations · {order.length}
        </div>
        {order.map((id) => {
          const c = conversations[id];
          if (!c) return null;
          const active = id === activeId;
          const isHover = hover === id;
          return (
            <div
              key={id}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => selectConversation(id)}
              style={{
                position: 'relative',
                padding: '8px 10px',
                marginBottom: 2,
                cursor: 'pointer',
                background: active ? 'var(--bg-3)' : isHover ? 'var(--bg-2)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.1s ease',
              }}
            >
              <MessageSquare size={12} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--fg-dimmer)' }} />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: active ? 'var(--fg)' : 'var(--fg-dim)',
                }}
              >
                {c.title || 'New chat'}
              </div>
              {c.messages.some((m) => m.pinned) && (
                <Pin size={10} style={{ color: 'var(--accent)' }} />
              )}
              {isHover && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this conversation?')) deleteConversation(id);
                  }}
                  style={{ color: 'var(--fg-dimmer)', padding: 2 }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: ads + current model + settings */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
        }}
      >
        {/* Smartlink above banner */}
        <div style={{ padding: '8px 12px 4px' }}>
          <AdSlot format="smartlink" />
        </div>
        <div style={{ padding: '4px 12px' }}>
          <AdSlot format="banner" />
        </div>
        {/* Native ad below banner */}
        <div style={{ padding: '4px 12px 8px' }}>
          <AdSlot format="native" />
        </div>
        <div
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
          }}
        >
        <div
          style={{
            width: 6,
            height: 6,
            background: 'var(--accent)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--accent-glow)',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono uppercase tiny dimmer" style={{ fontSize: 9 }}>Active model</div>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {modelDef?.label ?? model}
          </div>
        </div>
        <button
          onClick={() => useChat.getState().setPalette(true)}
          style={{ color: 'var(--fg-dim)', padding: 4 }}
          title="Settings (⌘K)"
        >
          <Settings size={14} />
        </button>
        </div>
      </div>
    </aside>
  );
}
