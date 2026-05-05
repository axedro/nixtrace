import { create } from 'zustand';
import type { NIxTraceStore, FilterState, TriggerRule, Session } from '../types/session.types';

const DEFAULT_FILTER: FilterState = {
  status:    'all',
  slice:     'all',
  procedure: 'all',
  iface:     'all',
  imsi:      '',
};

// Evaluate a single trigger rule against a session
function matchesTrigger(rule: TriggerRule, s: Session): boolean {
  if (!rule.enabled) return false;
  const { field, operator, value } = rule.condition;
  let actual: string;
  switch (field) {
    case 'status':      actual = s.status;             break;
    case 'procedure':   actual = s.procedure;          break;
    case 'slice':       actual = s.slice;              break;
    case 'imsi':        actual = s.imsi;               break;
    case 'duration_ms': actual = String(s.duration_ms); break;
    case 'packet_loss': actual = String(s.kpis.packetLoss ?? 0); break;
    default: return false;
  }
  switch (operator) {
    case 'eq':       return actual === value;
    case 'neq':      return actual !== value;
    case 'gt':       return parseFloat(actual) > parseFloat(value);
    case 'lt':       return parseFloat(actual) < parseFloat(value);
    case 'contains': return actual.includes(value);
    default: return false;
  }
}

export const useNIxStore = create<NIxTraceStore>((set, get) => ({
  sessions:         [],
  selectedSession:  null,
  selectedMessage:  null,
  filter:           DEFAULT_FILTER,
  wsConnected:      false,
  liveMode:         true,
  captureMode:      'online',
  historicalRange:  null,
  triggerRules:     [],
  triggerActive:    false,
  bufferSize:       500,
  showTriggerModal: false,

  addSession: (s) =>
    set((state) => {
      // Trigger check: if any trigger matches, force-add even when liveMode is off
      const triggered = state.triggerActive &&
        state.triggerRules.some((r) => matchesTrigger(r, s));

      if (!state.liveMode && !triggered) return {};

      const cap = state.bufferSize;
      return { sessions: [s, ...state.sessions].slice(0, cap) };
    }),

  selectSession:  (s) => set({ selectedSession: s, selectedMessage: null }),
  selectMessage:  (m) => set({ selectedMessage: m }),
  setFilter:      (f) => set((state) => ({ filter: { ...state.filter, ...f } })),
  setConnected:   (v) => set({ wsConnected: v }),
  setLiveMode:    (v) => set({ liveMode: v }),
  setCaptureMode: (m) => set({ captureMode: m }),
  setHistoricalRange: (r) => set({ historicalRange: r }),
  setTriggerRules:(rules) => set({ triggerRules: rules }),
  setTriggerActive:(v) => set({ triggerActive: v }),
  setBufferSize:  (n) => set({ bufferSize: n }),
  setShowTriggerModal: (v) => set({ showTriggerModal: v }),
}));

export { DEFAULT_FILTER };
