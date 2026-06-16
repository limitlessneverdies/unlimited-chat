import { useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, Code2, Eye, Download, Maximize2 } from 'lucide-react';
import { useChat } from '../store/chat';

/**
 * Claude.ai-style artifact previewer.
 * - Detects HTML / CSS / JS code blocks via the openArtifact() action.
 * - Renders a sandboxed iframe live preview alongside the source.
 * - Supports full HTML documents OR loose snippets (auto-wrapped).
 */
export default function ArtifactPane() {
  const code = useChat((s) => s.artifactCode);
  const lang = useChat((s) => s.artifactLang);
  const close = useChat((s) => s.closeArtifact);
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => {
    if (!code) return '';
    return buildSrcDoc(code, lang ?? 'html');
  }, [code, lang, refreshKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) {
        e.preventDefault();
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (!code) return null;

  function download() {
    const ext = (lang === 'css' || lang === 'js') ? lang : 'html';
    const blob = new Blob([code!], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifact.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const containerStyle: React.CSSProperties = fullscreen ? {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'var(--bg)',
    display: 'flex', flexDirection: 'column',
  } : {
    width: 'min(640px, 45vw)',
    minWidth: 380,
    height: '100%',
    background: 'var(--bg-1)',
    borderLeft: '1px solid var(--line-2)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  };

  return (
    <aside style={containerStyle}>
      {/* Header */}
      <header
        style={{
          height: 56,
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div className="mono uppercase tiny" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--accent)' }}>
          ARTIFACT · {(lang ?? 'html').toUpperCase()}
        </div>
        <div style={{ flex: 1 }} />

        <SegBtn active={mode === 'preview'} onClick={() => setMode('preview')} icon={<Eye size={11} />} label="Preview" />
        <SegBtn active={mode === 'source'}  onClick={() => setMode('source')}  icon={<Code2 size={11} />} label="Source" />

        <span style={{ width: 8 }} />

        <IconBtn title="Refresh" onClick={() => setRefreshKey((k) => k + 1)}><RefreshCw size={13} /></IconBtn>
        <IconBtn title="Download" onClick={download}><Download size={13} /></IconBtn>
        <IconBtn title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => setFullscreen((f) => !f)}><Maximize2 size={13} /></IconBtn>
        <IconBtn title="Close" onClick={close}><X size={14} /></IconBtn>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: mode === 'preview' ? '#fff' : 'var(--bg-1)' }}>
        {mode === 'preview' ? (
          <iframe
            ref={iframeRef}
            key={refreshKey}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            title="artifact-preview"
          />
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 16,
              height: '100%',
              overflow: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--fg)',
              background: 'var(--bg-1)',
              whiteSpace: 'pre',
            }}
          >
            {code}
          </pre>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          color: 'var(--fg-dimmer)',
        }}
        className="mono uppercase"
      >
          <span>SANDBOXED</span>
          <span>·</span>
          <span>{code.length.toLocaleString()} CHARS</span>
          <span style={{ marginLeft: 'auto' }}>{fullscreen ? 'ESC TO EXIT' : 'LIVE'}</span>
      </footer>
    </aside>
  );
}

function SegBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="mono uppercase tiny"
      style={{
        padding: '6px 10px',
        background: active ? 'var(--bg-3)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-dim)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 6,
        color: 'var(--fg-dim)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Build a self-contained HTML document from a code block.
 * - If the source already looks like a full HTML document, use it as-is.
 * - If lang is 'css' or 'js', wrap with a minimal shell.
 * - Otherwise (html/htm) wrap in a shell + base style reset.
 */
function buildSrcDoc(code: string, lang: string): string {
  const trimmed = code.trim();
  const looksLikeDoc =
    /^<!doctype html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed);

  if (looksLikeDoc) return code;

  const baseHead = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>artifact</title>
<style>
  html,body { margin:0; padding:0; font-family: system-ui, -apple-system, Segoe UI, Inter, sans-serif; background:#fff; color:#111; }
  body { padding: 16px; line-height: 1.5; }
</style>`;

  if (lang === 'css') {
    return `${baseHead}
<style>${code}</style>
</head>
<body>
  <h1>CSS preview</h1>
  <p>This is sample body text. <a href="#">a link</a></p>
  <button>Button</button>
  <ul><li>One</li><li>Two</li><li>Three</li></ul>
  <div class="card">A div with class "card".</div>
</body>
</html>`;
  }

  if (lang === 'js' || lang === 'javascript' || lang === 'jsx' || lang === 'tsx' || lang === 'ts' || lang === 'typescript') {
    return `${baseHead}
</head>
<body>
  <div id="app"></div>
  <script type="module">
    try {
${code}
    } catch (e) {
      document.body.innerHTML = '<pre style="color:#b00;padding:12px;">' + (e && e.stack || e) + '</pre>';
    }
  </script>
</body>
</html>`;
  }

  // Plain HTML snippet
  return `${baseHead}
</head>
<body>
${code}
</body>
</html>`;
}
