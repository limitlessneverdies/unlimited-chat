import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import { Copy, Pin, ExternalLink, AlertTriangle, Check, PlayCircle, CornerDownRight } from 'lucide-react';
import { useChat } from '../store/chat';
import { useModels } from '../store/models';
import { MODELS, modelById } from '../api/models';
import type { Message } from '../store/chat';
import AdSlot from './AdSlot';

export default function MessageList({ onContinue }: { onContinue?: (id: string) => void }) {
  const activeId = useChat((s) => s.activeId);
  const convo = useChat((s) => (activeId ? s.conversations[activeId] : null));
  const togglePin = useChat((s) => s.togglePin);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [convo?.messages.length, convo?.messages[convo.messages.length - 1]?.content]);

  // Group merge-fanout siblings (same mergeGroupId) so they render side-by-side.
  const rows = useMemo(() => {
    if (!convo) return [] as (Message | Message[])[];
    const out: (Message | Message[])[] = [];
    const seen = new Set<string>();
    for (const m of convo.messages) {
      if (m.mergeGroupId) {
        if (seen.has(m.mergeGroupId)) continue;
        seen.add(m.mergeGroupId);
        out.push(convo.messages.filter((x) => x.mergeGroupId === m.mergeGroupId));
      } else {
        out.push(m);
      }
    }
    return out;
  }, [convo]);

  if (!convo) return null;

  const hasMerge = rows.some((r) => Array.isArray(r));
  const pinned = convo.messages.filter((m) => m.pinned);
  const lastId = convo.messages[convo.messages.length - 1]?.id;

  return (
    <div style={{ maxWidth: hasMerge ? 1180 : 820, margin: '0 auto', padding: '32px 24px 120px' }}>
      {pinned.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            padding: 12,
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-1)',
          }}
        >
          <div className="mono uppercase tiny dimmer" style={{ fontSize: 10, marginBottom: 8 }}>
            <Pin size={10} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--accent)' }} />
            Pinned · {pinned.length}
          </div>
          {pinned.map((m) => (
            <div key={m.id} className="dim" style={{ fontSize: 12, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.content.slice(0, 120)}
            </div>
          ))}
        </div>
      )}

      {rows.map((row, idx) =>
        Array.isArray(row) ? (
          <div
            key={row[0].mergeGroupId}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
              gap: 12,
              marginBottom: 28,
            }}
          >
            {row.map((m) => (
              <div key={m.id} style={{ minWidth: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px', background: 'var(--bg-1)' }}>
                <MessageRow msg={m} onTogglePin={() => togglePin(m.id)} embedded />
              </div>
            ))}
          </div>
        ) : (
          <div key={row.id}>
            <MessageRow
              msg={row}
              onTogglePin={() => togglePin(row.id)}
              onContinue={onContinue}
              isLast={row.id === lastId}
            />
            {/* Inject ad between messages every 5 rows */}
            {(idx + 1) % 5 === 0 && idx < rows.length - 1 && (
              <div style={{ margin: '16px 0' }}>
                <AdSlot format="native" />
              </div>
            )}
          </div>
        ),
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageRow({
  msg,
  onTogglePin,
  onContinue,
  isLast,
  embedded,
}: {
  msg: Message;
  onTogglePin: () => void;
  onContinue?: (id: string) => void;
  isLast?: boolean;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const dynamic = useModels((s) => s.models);
  const catalog = dynamic.length > 0 ? dynamic : MODELS;
  const modelDef = msg.model ? modelById(msg.model, catalog as any) : null;
  const isUser = msg.role === 'user';

  function handleCopy() {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div style={{ marginBottom: embedded ? 0 : 28, animation: 'slideUp 0.25s ease' }}>
      {/* Role label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          className="mono uppercase tiny"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: isUser ? 'var(--fg)' : 'var(--accent)',
          }}
        >
          {isUser ? 'YOU' : (modelDef?.label ?? msg.model ?? 'ASSISTANT').toUpperCase()}
          {!isUser && msg.streaming && (
            <span className="dim shimmer" style={{ marginLeft: 8, fontWeight: 400 }}>thinking…</span>
          )}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <div className="mono tiny dimmer" style={{ fontSize: 10 }}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          paddingLeft: 12,
          borderLeft: `2px solid ${isUser ? 'var(--line-2)' : 'var(--accent)'}`,
        }}
      >
        {msg.error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 13 }}>
            <AlertTriangle size={14} />
            <span>{msg.error}</span>
          </div>
        ) : isUser ? (
          <div style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{stripAttachments(msg.content)}</div>
        ) : (
          <div className="md">
            <MarkdownView content={msg.content || (msg.streaming ? '…' : '')} streaming={!!msg.streaming} />
            {msg.streaming && msg.content && <span className="cursor" />}
          </div>
        )}

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {msg.attachments.map((a, i) => (
              <div key={i} className="mono tiny" style={{ padding: '4px 8px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--fg-dim)' }}>
                {a.name} <span className="dimmer">· {Math.round(a.size / 1024)}KB</span>
              </div>
            ))}
          </div>
        )}

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <div className="mono uppercase tiny dimmer" style={{ fontSize: 10, marginBottom: 8 }}>
              Sources · {msg.sources.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {msg.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    color: 'var(--fg-dim)',
                    textDecoration: 'none',
                  }}
                >
                  <span className="mono tiny accent" style={{ minWidth: 18 }}>[{i + 1}]</span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title || s.url}
                  </span>
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!msg.streaming && (
          <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <ActionBtn icon={copied ? <Check size={11} /> : <Copy size={11} />} label={copied ? 'Copied' : 'Copy'} onClick={handleCopy} active={copied} />
            <ActionBtn icon={<Pin size={11} />} label={msg.pinned ? 'Unpin' : 'Pin'} onClick={onTogglePin} active={!!msg.pinned} />
            {!isUser && isLast && onContinue && (
              <ActionBtn icon={<CornerDownRight size={11} />} label="Continue" onClick={() => onContinue(msg.id)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="mono uppercase tiny"
      style={{
        padding: '4px 8px',
        background: active ? 'var(--accent-glow)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-dimmer)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        fontWeight: 700,
      }}
      title={label}
    >
      {icon}
      {label}
    </button>
  );
}

function stripAttachments(text: string): string {
  return text.replace(/\n\n--- ATTACHMENT:[\s\S]*?--- END ATTACHMENT ---/g, '').trim();
}

// ===== Markdown rendering: GFM + math (KaTeX) + highlight + mermaid + artifacts =====

const ARTIFACT_LANGS = new Set(['html', 'htm', 'xml', 'svg', 'css', 'js', 'javascript', 'jsx', 'ts', 'tsx', 'typescript']);

function MarkdownView({ content, streaming }: { content: string; streaming: boolean }) {
  const openArtifact = useChat((s) => s.openArtifact);

  const components = useMemo(
    () => ({
      // Pre becomes a pass-through; the code renderer emits the full block markup.
      pre: ({ children }: any) => <>{children}</>,
      code: ({ node, className, children }: any) => {
        const m = /language-([\w-]+)/.exec(className || '');
        const lang = m?.[1]?.toLowerCase();
        const raw = node ? hastText(node) : String(children ?? '');
        const isBlock = !!lang || raw.includes('\n');
        if (!isBlock) return <code className={className}>{children}</code>;
        if (lang === 'mermaid') return <Mermaid code={raw} streaming={streaming} />;
        return (
          <CodeCard lang={lang} raw={raw} className={className} openArtifact={openArtifact}>
            {children}
          </CodeCard>
        );
      },
    }),
    [openArtifact, streaming],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeHighlight, rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeCard({
  lang,
  raw,
  className,
  children,
  openArtifact,
}: {
  lang?: string;
  raw: string;
  className?: string;
  children: React.ReactNode;
  openArtifact: (code: string, lang: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const canArtifact = !!lang && ARTIFACT_LANGS.has(lang);

  function copy() {
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', margin: '12px 0', background: 'var(--bg-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        <span className="mono uppercase tiny dimmer" style={{ fontSize: 9, letterSpacing: '0.1em' }}>{lang || 'text'}</span>
        <div style={{ flex: 1 }} />
        {canArtifact && (
          <button
            onClick={() => openArtifact(raw, lang!)}
            className="mono uppercase tiny"
            title="Open live preview"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', fontSize: 9, fontWeight: 700 }}
          >
            <PlayCircle size={11} /> Preview
          </button>
        )}
        <button
          onClick={copy}
          className="mono uppercase tiny"
          title="Copy code"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', color: copied ? 'var(--accent)' : 'var(--fg-dimmer)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: 9, fontWeight: 700 }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: 12, overflow: 'auto' }}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

let mermaidReady = false;
let mmdSeq = 0;
function Mermaid({ code, streaming }: { code: string; streaming: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef('mmd-' + ++mmdSeq);

  useEffect(() => {
    // Don't attempt to render partial diagram source mid-stream — it throws
    // on every delta and flashes the error fallback. Wait until streaming ends.
    if (streaming) return;

    if (!mermaidReady) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose', fontFamily: 'inherit' });
      mermaidReady = true;
    }
    let cancelled = false;
    const renderId = idRef.current;
    mermaid
      .render(renderId, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message ?? e));
        // On error mermaid leaves an orphaned temp node attached to <body>.
        document.getElementById(renderId)?.remove();
        document.getElementById('d' + renderId)?.remove();
      });
    return () => {
      cancelled = true;
    };
  }, [code, streaming]);

  if (streaming) {
    return (
      <div className="mono uppercase tiny dimmer" style={{ margin: '12px 0', padding: 12, border: '1px dashed var(--line-2)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.1em' }}>
        <span className="shimmer accent">◇</span> rendering diagram when complete…
      </div>
    );
  }

  if (err) {
    return (
      <pre style={{ margin: '12px 0', padding: 12, border: '1px solid var(--danger)', borderRadius: 'var(--radius)', color: 'var(--danger)', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        mermaid error: {err}
        {'\n\n'}
        {code}
      </pre>
    );
  }
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', overflow: 'auto' }} />;
}

// Recursively pull raw text out of a hast node (highlighted children are
// React elements, so we read the original source from the node tree).
function hastText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(hastText).join('');
  return '';
}
