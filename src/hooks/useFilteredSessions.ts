import { useMemo } from 'react';
import { useNIxStore } from '../store/nixStore';
import type { Session } from '../types/session.types';

export function useFilteredSessions(): Session[] {
  const sessions = useNIxStore((s) => s.sessions);
  const filter   = useNIxStore((s) => s.filter);

  return useMemo(() => {
    return sessions.filter((s) => {
      if (filter.status    !== 'all' && s.status    !== filter.status)    return false;
      if (filter.slice     !== 'all' && s.slice     !== filter.slice)     return false;
      if (filter.procedure !== 'all' && s.procedure !== filter.procedure) return false;
      if (filter.iface !== 'all' && !s.messages.some((m) => m.iface === filter.iface)) return false;
      if (filter.imsi && !s.imsi.includes(filter.imsi))                   return false;
      return true;
    });
  }, [sessions, filter]);
}
