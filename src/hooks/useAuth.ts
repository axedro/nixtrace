import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isOfflineMode } from '../lib/supabaseClient';

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(!isOfflineMode);

  useEffect(() => {
    if (isOfflineMode) return;

    supabase!.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
