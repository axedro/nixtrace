import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isOfflineMode =
  !supabaseUrl ||
  !supabaseKey ||
  supabaseUrl.includes('xxxxxxxxxxxx');

export const supabase = isOfflineMode
  ? null
  : createClient(supabaseUrl, supabaseKey);

export function signOut(): Promise<void> {
  return supabase?.auth.signOut().then(() => undefined) ?? Promise.resolve();
}
