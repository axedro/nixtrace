import { useRef, useEffect, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import { useFilteredSessions } from '../../hooks/useFilteredSessions';
import type { Session } from '../../types/session.types';
import './SessionTable.css';

export function SessionTable() {
  const selectedSession = useNIxStore((s) => s.selectedSession);
  const selectSession   = useNIxStore((s) => s.selectSession);
  const sessions        = useNIxStore((s) => s.sessions);
  const filtered        = useFilteredSessions();

  const scrollRef   = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const newIdsRef    = useRef<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);

  // Track newly added sessions for fade-in animation
  useEffect(() => {
    const curr = sessions.length;
    const prev = prevCountRef.current;
    if (curr > prev) {
      const added = sessions.slice(0, curr - prev);
      added.forEach((s) => {
        newIdsRef.current.add(s.id);
        setTimeout(() => { newIdsRef.current.delete(s.id); }, 300);
      });

      // If scrolled away from top, accumulate new badge count
      const scrollEl = scrollRef.current;
      if (scrollEl && scrollEl.scrollTop > 50) {
        setNewCount((n) => n + (curr - prev));
      }
    }
    prevCountRef.current = curr;
  }, [sessions]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewCount(0);
  }, []);

  const virtualizer = useVirtualizer({
    count:            filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize:     () => 28,
    overscan:         12,
  });

  function formatTime(ts: string): string {
    try { return format(parseISO(ts), 'HH:mm:ss.SSS'); }
    catch { return ts; }
  }

  function handleRowClick(s: Session) {
    selectSession(s);
    setNewCount(0);
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div className="st-wrap">
      {/* Fixed header */}
      <div className="st-header">
        <span className="st-header-cell">Time</span>
        <span className="st-header-cell">IMSI</span>
        <span className="st-header-cell">Procedure</span>
        <span className="st-header-cell">Iface</span>
        <span className="st-header-cell right">Duration</span>
        <span className="st-header-cell center">St</span>
      </div>

      {/* Virtual scroll area */}
      <div className="st-scroll" ref={scrollRef} onScroll={() => { if ((scrollRef.current?.scrollTop ?? 0) <= 10) setNewCount(0); }}>

        {newCount > 0 && (
          <div className="st-new-badge" onClick={scrollToTop}>
            ↑ {newCount} new
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="st-empty">
            <span className="st-empty-icon">◎</span>
            <span>No sessions match filter</span>
          </div>
        ) : (
          <div className="st-virtual-inner" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((vItem) => {
              const s = filtered[vItem.index];
              const isNew = newIdsRef.current.has(s.id);
              return (
                <div
                  key={s.id}
                  className={clsx('st-row', {
                    'st-row--err':      s.status === 'err',
                    'st-row--warn':     s.status === 'warn',
                    'st-row--selected': s.id === selectedSession?.id,
                    'st-row--new':      isNew,
                  })}
                  style={{ top: vItem.start }}
                  onClick={() => handleRowClick(s)}
                  title={`IMSI: ${s.imsi} | gNB: ${s.gnb} | AMF: ${s.amf}`}
                >
                  <span className="st-cell mono">{formatTime(s.created_at)}</span>
                  <span className="st-cell mono" title={s.imsi}>
                    ···{s.imsi.slice(-6)}
                  </span>
                  <span className="st-cell" title={s.procedure}>{s.procedure}</span>
                  <span className="st-cell mono" style={{ color: 'var(--text-secondary)' }}>
                    {s.primary_iface}
                  </span>
                  <span className="st-cell mono right" style={{ color: 'var(--text-secondary)' }}>
                    {s.duration_ms}ms
                  </span>
                  <span className="st-cell center">
                    <span className={`st-dot st-dot--${s.status}`} title={s.status} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
