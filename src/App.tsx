import { useEffect, useRef } from 'react';
import { useChat } from './store/chat';
import { useModels } from './store/models';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import CommandPalette from './components/CommandPalette';
import ArtifactPane from './components/ArtifactPane';
import SystemPromptEditor from './components/SystemPromptEditor';
import MergePicker from './components/MergePicker';
import AdSlot from './components/AdSlot';

export default function App() {
  const activeId = useChat((s) => s.activeId);
  const newConversation = useChat((s) => s.newConversation);
  const setPalette = useChat((s) => s.setPalette);
  const artifactPaneOpen = useChat((s) => s.artifactPaneOpen);
  const loadModels = useModels((s) => s.load);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (!activeId) newConversation();
    loadModels();
  }, [activeId, newConversation, loadModels]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        newConversation();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, newConversation]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg)' }}>
      <Sidebar />
      <ChatView />
      {artifactPaneOpen && <ArtifactPane />}
      <CommandPalette />
      <SystemPromptEditor />
      <MergePicker />
      <AdSlot format="social-bar" />
    </div>
  );
}
