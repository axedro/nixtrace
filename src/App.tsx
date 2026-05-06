import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useRealtimeSessions } from './hooks/useRealtimeSessions';
import { useAuth } from './hooks/useAuth';
import { useNIxStore } from './store/nixStore';
import { isOfflineMode } from './lib/supabaseClient';
import { TopBar } from './components/TopBar/TopBar';
import { FilterBar } from './components/FilterBar/FilterBar';
import { SessionTable } from './components/SessionTable/SessionTable';
import { LadderDiagram } from './components/LadderDiagram/LadderDiagram';
import { MessageDecode } from './components/MessageDecode/MessageDecode';
import { SessionKPIs } from './components/SessionKPIs/SessionKPIs';
import { DPIPanel } from './components/DPIPanel/DPIPanel';
import { TriggerModal } from './components/TriggerModal/TriggerModal';
import { LoginPage } from './components/LoginPage/LoginPage';
import './App.css';

type TabId = 'ladder' | 'decode' | 'kpis' | 'dpi';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ladder', label: 'Ladder' },
  { id: 'decode', label: 'Decode' },
  { id: 'kpis',   label: 'KPIs' },
  { id: 'dpi',    label: 'DPI / User Plane' },
];

function App() {
  useRealtimeSessions();
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab]           = useState<TabId>('ladder');
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C' | null>(null);

  const selectedSession = useNIxStore((s) => s.selectedSession);
  const selectedMessage = useNIxStore((s) => s.selectedMessage);
  const showTrigger     = useNIxStore((s) => s.showTriggerModal);
  const theme           = useNIxStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Auto-switch to decode tab when a message is clicked in the ladder
  const [prevMsgId, setPrevMsgId] = useState<string | null>(null);
  if (selectedMessage && selectedMessage.id !== prevMsgId) {
    setPrevMsgId(selectedMessage.id);
    if (activeTab !== 'decode') setActiveTab('decode');
  }

  // Auto-switch to DPI tab when session has VoNR (highlight MOS)
  const prevSessionId = useState<string | null>(null);
  if (selectedSession && selectedSession.id !== prevSessionId[0]) {
    prevSessionId[1](selectedSession.id);
    if (selectedSession.procedure.startsWith('VoNR') && activeTab !== 'dpi') {
      setActiveTab('dpi');
    }
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-main)' }}>
        <span style={{ color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:12 }}>Authenticating…</span>
      </div>
    );
  }

  if (!user && !isOfflineMode) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <TopBar
        activeScenario={activeScenario}
        onScenario={(id) => setActiveScenario((prev) => (prev === id ? null : id))}
      />
      <FilterBar />

      <div className="app-body">
        <SessionTable />

        <div className="app-right">
          <div className="app-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={clsx('app-tab', { 'app-tab--active': activeTab === t.id })}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.id === 'dpi' && selectedSession?.dpi?.anomalies?.length ? (
                  <span style={{
                    marginLeft: 4, display: 'inline-block',
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent-red)', verticalAlign: 'middle',
                  }} />
                ) : null}
              </button>
            ))}
          </div>

          <div className="app-panel">
            {activeTab === 'ladder' && <LadderDiagram />}
            {activeTab === 'decode' && <MessageDecode />}
            {activeTab === 'kpis'   && <SessionKPIs />}
            {activeTab === 'dpi'    && <DPIPanel />}
          </div>
        </div>
      </div>

      {showTrigger && <TriggerModal />}
    </div>
  );
}

export default App;
