import { create } from 'zustand';
import type { NIxTraceStore, FilterState } from '../types/session.types';

const DEFAULT_FILTER: FilterState = {
  status:    'all',
  slice:     'all',
  procedure: 'all',
  iface:     'all',
  imsi:      '',
};

export const useNIxStore = create<NIxTraceStore>((set) => ({
  sessions:        [],
  selectedSession: null,
  selectedMessage: null,
  filter:          DEFAULT_FILTER,
  wsConnected:     false,
  liveMode:        true,

  addSession: (s) =>
    set((state) => ({
      sessions: [s, ...state.sessions].slice(0, 500),
    })),

  selectSession: (s) => set({ selectedSession: s, selectedMessage: null }),
  selectMessage: (m) => set({ selectedMessage: m }),

  setFilter: (f) =>
    set((state) => ({ filter: { ...state.filter, ...f } })),

  setConnected: (v) => set({ wsConnected: v }),
  setLiveMode:  (v) => set({ liveMode: v }),
}));

export { DEFAULT_FILTER };
