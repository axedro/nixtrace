import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import { isOfflineMode } from '../../lib/supabaseClient';
import type { DemoScenario } from '../../types/session.types';
import './TopBar.css';

const SCENARIOS: DemoScenario[] = [
  {
    id: 'A',
    label: 'A · Auth Failure',
    filter: { status: 'err', procedure: 'Authentication Failure' },
    autoSelectFirst: true,
  },
  {
    id: 'B',
    label: 'B · uRLLC Handover',
    filter: { slice: 'uRLLC', procedure: 'Handover (Xn)' },
    autoSelectFirst: true,
  },
  {
    id: 'C',
    label: 'C · PDU Lifecycle',
    filter: {},
    autoSelectFirst: true,
  },
];

interface TopBarProps {
  onScenario?: (id: 'A' | 'B' | 'C') => void;
  activeScenario?: 'A' | 'B' | 'C' | null;
}

export function TopBar({ onScenario, activeScenario }: TopBarProps) {
  const wsConnected = useNIxStore((s) => s.wsConnected);
  const liveMode    = useNIxStore((s) => s.liveMode);
  const setLiveMode = useNIxStore((s) => s.setLiveMode);
  const setFilter   = useNIxStore((s) => s.setFilter);
  const sessions    = useNIxStore((s) => s.sessions);
  const selectSession = useNIxStore((s) => s.selectSession);

  const [clock, setClock] = useState(() => format(new Date(), 'HH:mm:ss'));

  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), 'HH:mm:ss')), 1000);
    return () => clearInterval(id);
  }, []);

  function handleScenario(sc: DemoScenario) {
    // Reset to 'all' defaults first, then apply scenario filter
    setFilter({
      status: 'all', slice: 'all', procedure: 'all', iface: 'all', imsi: '',
      ...sc.filter,
    });
    onScenario?.(sc.id);

    // Auto-select first matching session after filter applies
    if (sc.autoSelectFirst && sessions.length > 0) {
      const first = sessions.find((s) => {
        if (sc.filter.status    && s.status    !== sc.filter.status)    return false;
        if (sc.filter.slice     && s.slice     !== sc.filter.slice)     return false;
        if (sc.filter.procedure && s.procedure !== sc.filter.procedure) return false;
        return true;
      });
      if (first) selectSession(first);
    }
  }

  const connMode = isOfflineMode ? 'local' : wsConnected ? 'live' : 'dead';

  return (
    <div className="tb-wrap">
      {/* Logo */}
      <div className="tb-logo">
        <span className="tb-logo-nix">NIx</span>
        <span className="tb-logo-trace">Trace</span>
        <span className="tb-logo-tag">5G SA</span>
      </div>

      <div className="tb-div" />

      {/* Connection indicator */}
      <div className="tb-conn">
        <span className={`tb-conn-dot tb-conn-dot--${connMode}`} />
        <span className={`tb-conn-label--${connMode}`}>
          {connMode === 'live' ? 'LIVE' : connMode === 'local' ? 'LOCAL' : 'OFFLINE'}
        </span>
      </div>

      <div className="tb-div" />

      {/* Scenario bookmarks */}
      <div className="tb-scenarios">
        {SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            className={clsx('tb-scenario-btn', {
              'tb-scenario-btn--active': activeScenario === sc.id,
            })}
            onClick={() => handleScenario(sc)}
            title={`Scenario ${sc.id}`}
          >
            {sc.label}
          </button>
        ))}
      </div>

      <div className="tb-spacer" />

      {/* Live toggle */}
      <button
        className={clsx('tb-live-toggle', { 'tb-live-toggle--on': liveMode })}
        onClick={() => setLiveMode(!liveMode)}
        title={liveMode ? 'Pause live feed' : 'Resume live feed'}
      >
        {liveMode && <span className="tb-live-pulse" />}
        LIVE
      </button>

      {/* Clock */}
      <span className="tb-clock">{clock}</span>
    </div>
  );
}
