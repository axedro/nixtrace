import { useState } from 'react';
import clsx from 'clsx';
import { useRealtimeSessions } from './hooks/useRealtimeSessions';
import { useNIxStore } from './store/nixStore';
import { TopBar } from './components/TopBar/TopBar';
import { FilterBar } from './components/FilterBar/FilterBar';
import { SessionTable } from './components/SessionTable/SessionTable';
import { LadderDiagram } from './components/LadderDiagram/LadderDiagram';
import { MessageDecode } from './components/MessageDecode/MessageDecode';
import { SessionKPIs } from './components/SessionKPIs/SessionKPIs';
import './App.css';

type TabId = 'ladder' | 'decode' | 'kpis';

function App() {
  useRealtimeSessions();

  const [activeTab, setActiveTab]         = useState<TabId>('ladder');
  const [activeScenario, setActiveScenario] = useState<'A' | 'B' | 'C' | null>(null);

  const selectedSession = useNIxStore((s) => s.selectedSession);
  const selectedMessage = useNIxStore((s) => s.selectedMessage);

  // Auto-switch to decode tab when a message is selected via ladder click
  const prevMsgId = useState<string | null>(null);
  if (selectedMessage && selectedMessage.id !== prevMsgId[0]) {
    prevMsgId[1](selectedMessage.id);
    if (activeTab !== 'decode') setActiveTab('decode');
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
          {/* Tab bar */}
          <div className="app-tabs">
            {(['ladder', 'decode', 'kpis'] as TabId[]).map((t) => (
              <button
                key={t}
                className={clsx('app-tab', { 'app-tab--active': activeTab === t })}
                onClick={() => setActiveTab(t)}
              >
                {t === 'ladder' ? 'Ladder' : t === 'decode' ? 'Decode' : 'KPIs'}
                {!selectedSession && ' ·'}
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div className="app-panel">
            {activeTab === 'ladder' && <LadderDiagram />}
            {activeTab === 'decode' && <MessageDecode />}
            {activeTab === 'kpis'   && <SessionKPIs />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
