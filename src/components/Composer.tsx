import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Send, Square, X, FileText } from 'lucide-react';
import { extractFile } from '../api/client';
import { useChat } from '../store/chat';
import { estimateTokens, formatTokens } from '../lib/tokens';

interface Attachment {
  name: string;
  size: number;
  text: string;
  status: 'pending' | 'ready' | 'error';
  error?: string;
}

interface Props {
  onSend: (text: string, attachments?: { name: string; size: number; text: string }[]) => void | Promise<void>;
  onStop: () => void;
  streaming: boolean;
}

export default function Composer({ onSend, onStop, streaming }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const webSearch = useChat((s) => s.webSearch);

  // Live token estimate — prompt text plus extracted attachment payloads.
  const tokens = useMemo(() => {
    const attachText = attachments
      .filter((a) => a.status === 'ready')
      .reduce((sum, a) => sum + estimateTokens(a.text), 0);
    return estimateTokens(text) + attachText;
  }, [text, attachments]);

  // Autosize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 280) + 'px';
  }, [text]);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    for (const f of arr) {
      if (f.size > 2 * 1024 * 1024) {
        setAttachments((a) => [...a, { name: f.name, size: f.size, text: '', status: 'error', error: 'over 2MB' }]);
        continue;
      }
      const pending: Attachment = { name: f.name, size: f.size, text: '', status: 'pending' };
      setAttachments((a) => [...a, pending]);
      try {
        const { text: extracted, truncated } = await extractFile(f);
        setAttachments((a) => a.map((x) => x.name === f.name && x.status === 'pending'
          ? { ...x, text: extracted + (truncated ? '\n[...truncated]' : ''), status: 'ready' }
          : x));
      } catch (e: any) {
        setAttachments((a) => a.map((x) => x.name === f.name && x.status === 'pending'
          ? { ...x, status: 'error', error: e.message }
          : x));
      }
    }
  }

  function handleSubmit() {
    if (streaming) return;
    const ready = attachments.filter((a) => a.status === 'ready');
    if (!text.trim() && ready.length === 0) return;
    onSend(text, ready.map((a) => ({ name: a.name, size: a.size, text: a.text })));
    setText('');
    setAttachments([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function removeAttachment(name: string) {
    setAttachments((a) => a.filter((x) => x.name !== name));
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
      style={{
        padding: '16px 24px 20px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {dragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--accent-glow)',
            border: '2px dashed var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            pointerEvents: 'none',
          }}
          className="mono uppercase"
        >
          <div style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.2em' }}>Drop to attach</div>
        </div>
      )}

      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {/* Attachments row */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {attachments.map((a) => (
              <div
                key={a.name}
                className="mono tiny"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 4px 4px 8px',
                  background: a.status === 'error' ? 'rgba(255,51,85,0.1)' : 'var(--bg-2)',
                  border: `1px solid ${a.status === 'error' ? 'var(--danger)' : a.status === 'ready' ? 'var(--accent)' : 'var(--line-2)'}`,
                  borderRadius: 'var(--radius)',
                  color: a.status === 'error' ? 'var(--danger)' : 'var(--fg-dim)',
                  fontSize: 11,
                }}
              >
                <FileText size={11} />
                <span>{a.name}</span>
                <span className="dimmer">· {Math.round(a.size / 1024)}KB</span>
                {a.status === 'pending' && <span className="shimmer accent">…</span>}
                {a.status === 'error' && <span className="dim">({a.error})</span>}
                <button onClick={() => removeAttachment(a.name)} style={{ color: 'var(--fg-dimmer)', padding: 2 }}>
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: 'var(--bg-1)',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius)',
            padding: 8,
            transition: 'border-color 0.12s ease',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line-2)')}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ padding: 8, color: 'var(--fg-dim)' }}
            title="Attach files"
          >
            <Paperclip size={16} />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={webSearch ? 'Search the web…' : 'Ask anything. Drag files. Shift+Enter for newline.'}
            style={{
              flex: 1,
              minHeight: 24,
              padding: '8px 4px',
              background: 'transparent',
              color: 'var(--fg)',
              fontSize: 14.5,
              lineHeight: 1.5,
              border: 'none',
              outline: 'none',
            }}
          />
          {streaming ? (
            <button
              onClick={onStop}
              style={{
                padding: '8px 12px',
                background: 'var(--danger)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 'var(--radius)',
              }}
              title="Stop"
            >
              <Square size={12} fill="#fff" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!text.trim() && attachments.filter((a) => a.status === 'ready').length === 0}
              style={{
                padding: '8px 12px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 'var(--radius)',
                opacity: (!text.trim() && attachments.filter((a) => a.status === 'ready').length === 0) ? 0.4 : 1,
              }}
              title="Send (Enter)"
            >
              Send
              <Send size={12} />
            </button>
          )}
        </div>

        <div className="mono uppercase tiny dimmer" style={{ fontSize: 9, marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.15em' }}>
          <span style={{ flex: 1 }}>ENTER to send · SHIFT+ENTER newline · ⌘K commands · ⌘N new chat</span>
          {tokens > 0 && (
            <span className="accent" style={{ flexShrink: 0 }} title="Estimated input tokens">
              ~{formatTokens(tokens)} TOK
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
