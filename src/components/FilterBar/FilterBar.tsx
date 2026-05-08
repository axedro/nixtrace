import { useRef, useCallback } from 'react';
import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import { DEFAULT_FILTER } from '../../store/nixStore';
import type { FilterState, SessionStatus, InterfaceName, ProcedureName } from '../../types/session.types';
import './FilterBar.css';

const PROCEDURE_OPTIONS: ProcedureName[] = [
  '5G SA Registration + PDU',
  'VoNR Session Setup',
];

function isActive(val: string) { return val !== 'all' && val !== ''; }

export function FilterBar() {
  const filter    = useNIxStore((s) => s.filter);
  const setFilter = useNIxStore((s) => s.setFilter);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImsi = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilter({ imsi: v }), 150);
  }, [setFilter]);

  function set<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setFilter({ [k]: v } as Partial<FilterState>);
  }

  const anyActive =
    filter.status !== 'all' ||
    filter.procedure !== 'all' || filter.iface !== 'all' || filter.imsi !== '';

  return (
    <div className="fb-wrap">
      <span className="fb-label">Filter</span>

      {/* IMSI */}
      <input
        className="fb-input"
        placeholder="IMSI…"
        defaultValue={filter.imsi}
        onChange={handleImsi}
        spellCheck={false}
      />

      <div className="fb-div" />

      {/* Interface */}
      <select
        className={clsx('fb-select', { 'fb-select--active': isActive(filter.iface) })}
        value={filter.iface}
        onChange={(e) => set('iface', e.target.value as InterfaceName | 'all')}
      >
        <option value="all">Iface: all</option>
        {(['Uu','N1','N2','N3','N4','N7','N8','N10','N11','N12','N13','N15','Gm','ISC'] as InterfaceName[]).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      {/* Status */}
      <select
        className={clsx('fb-select', { 'fb-select--active': isActive(filter.status) })}
        value={filter.status}
        onChange={(e) => set('status', e.target.value as SessionStatus | 'all')}
      >
        <option value="all">Status: all</option>
        <option value="ok">OK</option>
        <option value="warn">WARN</option>
        <option value="err">ERR</option>
      </select>

      {/* Procedure */}
      <select
        className={clsx('fb-select', { 'fb-select--active': isActive(filter.procedure) })}
        value={filter.procedure}
        onChange={(e) => set('procedure', e.target.value as ProcedureName | 'all')}
        style={{ minWidth: 220 }}
      >
        <option value="all">Procedure: all</option>
        {PROCEDURE_OPTIONS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      {anyActive && (
        <>
          <div className="fb-div" />
          <button
            className="fb-clear-btn"
            onClick={() => setFilter(DEFAULT_FILTER)}
          >
            ✕ Clear
          </button>
        </>
      )}
    </div>
  );
}
