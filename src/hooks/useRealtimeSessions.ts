import { useEffect, useRef } from 'react';
import { supabase, isOfflineMode } from '../lib/supabaseClient';
import { useNIxStore } from '../store/nixStore';
import { generateDemoSession } from '../data/demoSessionGenerator';
import type { Session } from '../types/session.types';

export function useRealtimeSessions() {
  const addSession  = useNIxStore((s) => s.addSession);
  const liveMode    = useNIxStore((s) => s.liveMode);
  const setConnected = useNIxStore((s) => s.setConnected);

  // Ref so the subscription callback always reads the current liveMode
  const liveModeRef = useRef(liveMode);
  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);

  useEffect(() => {
    // ── Offline / local mode ──────────────────────────────────────────────────
    if (isOfflineMode) {
      setConnected(true);
      let stopped = false;

      // Pre-seed with 20 historical sessions
      for (let i = 0; i < 20; i++) {
        addSession(generateDemoSession());
      }

      const tick = () => {
        if (stopped) return;
        if (liveModeRef.current) {
          addSession(generateDemoSession());
        }
        const delay = 800 + Math.random() * 700;
        setTimeout(tick, delay);
      };
      const initialDelay = 800 + Math.random() * 700;
      setTimeout(tick, initialDelay);

      return () => { stopped = true; setConnected(false); };
    }

    // ── Supabase realtime mode ────────────────────────────────────────────────
    if (!supabase) return;

    // Load last 50 sessions on mount
    supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) { console.error('[NIxTrace] initial load:', error.message); return; }
        if (!data) return;
        // Reverse so oldest goes in first (prepend logic keeps newest at [0])
        [...data].reverse().forEach((row) => addSession(row as Session));
      });

    // Keep Realtime auth token in sync with the user session
    const { data: { subscription: authSub } } = supabase!.auth.onAuthStateChange(
      (_event, session) => {
        supabase!.realtime.setAuth(session?.access_token ?? null);
      }
    );

    // Subscribe to INSERT events
    const channel = supabase!
      .channel('sessions-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        (payload) => {
          if (liveModeRef.current) {
            addSession(payload.new as Session);
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      authSub.unsubscribe();
      supabase!.removeChannel(channel);
      setConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // subscribe once — liveMode changes handled via ref
}
