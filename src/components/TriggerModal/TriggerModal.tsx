import { useState } from 'react';
import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import type { TriggerRule } from '../../types/session.types';
import './TriggerModal.css';

function uid() { return Math.random().toString(36).slice(2, 9); }

const FIELD_LABELS: Record<string, string> = {
  status:      'Status',
  procedure:   'Procedure',
  slice:       'Slice',
  imsi:        'IMSI',
  duration_ms: 'Duration (ms)',
  packet_loss: 'Packet Loss (%)',
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', lt: '<', contains: 'contains',
};

export function TriggerModal() {
  const rules             = useNIxStore((s) => s.triggerRules);
  const setRules          = useNIxStore((s) => s.setTriggerRules);
  const triggerActive     = useNIxStore((s) => s.triggerActive);
  const setTriggerActive  = useNIxStore((s) => s.setTriggerActive);
  const bufferSize        = useNIxStore((s) => s.bufferSize);
  const setBufferSize     = useNIxStore((s) => s.setBufferSize);
  const setShow           = useNIxStore((s) => s.setShowTriggerModal);

  const [draft, setDraft] = useState<Omit<TriggerRule,'id'>>({
    enabled:   true,
    label:     '',
    condition: { field: 'status', operator: 'eq', value: 'err' },
    action:    'capture',
  });

  function addRule() {
    if (!draft.label.trim()) return;
    setRules([...rules, { ...draft, id: uid() }]);
    setDraft({ enabled: true, label: '', condition: { field: 'status', operator: 'eq', value: 'err' }, action: 'capture' });
  }

  function removeRule(id: string) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function toggleRule(id: string) {
    setRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  return (
    <div className="tm-overlay" onClick={() => setShow(false)}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-header">
          <span className="tm-title">Trigger-Based Capture</span>
          <button className="tm-close" onClick={() => setShow(false)}>✕</button>
        </div>

        <div className="tm-body">
          {/* Cyclic buffer */}
          <div className="tm-section">
            <div className="tm-section-title">Cyclic Buffer</div>
            <div className="tm-row">
              <label className="tm-label">Buffer size (sessions)</label>
              <input
                type="number"
                className="tm-input"
                value={bufferSize}
                min={50} max={5000}
                onChange={(e) => setBufferSize(Number(e.target.value))}
              />
            </div>
            <p className="tm-hint">FIFO — oldest sessions are discarded when buffer is full.</p>
          </div>

          {/* Master trigger switch */}
          <div className="tm-section">
            <div className="tm-section-title">Trigger Engine</div>
            <div className="tm-row">
              <label className="tm-label">Enable triggers</label>
              <button
                className={clsx('tm-toggle', { 'tm-toggle--on': triggerActive })}
                onClick={() => setTriggerActive(!triggerActive)}
              >
                {triggerActive ? '● ACTIVE' : '○ INACTIVE'}
              </button>
            </div>
            <p className="tm-hint">When active, sessions matching any rule are captured even if live mode is paused.</p>
          </div>

          {/* Existing rules */}
          {rules.length > 0 && (
            <div className="tm-section">
              <div className="tm-section-title">Active Rules ({rules.length})</div>
              {rules.map((r) => (
                <div key={r.id} className={clsx('tm-rule', { 'tm-rule--disabled': !r.enabled })}>
                  <button className="tm-rule-toggle" onClick={() => toggleRule(r.id)} title="Enable/disable">
                    {r.enabled ? '●' : '○'}
                  </button>
                  <div className="tm-rule-body">
                    <span className="tm-rule-label">{r.label}</span>
                    <span className="tm-rule-cond">
                      {FIELD_LABELS[r.condition.field]} {OPERATOR_LABELS[r.condition.operator]} "{r.condition.value}" → {r.action}
                    </span>
                  </div>
                  <button className="tm-rule-del" onClick={() => removeRule(r.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add rule */}
          <div className="tm-section">
            <div className="tm-section-title">Add Rule</div>
            <div className="tm-row">
              <label className="tm-label">Label</label>
              <input
                className="tm-input tm-input--wide"
                placeholder="e.g. Capture auth failures"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div className="tm-row tm-row--3">
              <select
                className="tm-select"
                value={draft.condition.field}
                onChange={(e) => setDraft({ ...draft, condition: { ...draft.condition, field: e.target.value as TriggerRule['condition']['field'] } })}
              >
                {Object.entries(FIELD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <select
                className="tm-select"
                value={draft.condition.operator}
                onChange={(e) => setDraft({ ...draft, condition: { ...draft.condition, operator: e.target.value as TriggerRule['condition']['operator'] } })}
              >
                {Object.entries(OPERATOR_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <input
                className="tm-input"
                placeholder="value"
                value={draft.condition.value}
                onChange={(e) => setDraft({ ...draft, condition: { ...draft.condition, value: e.target.value } })}
              />
            </div>
            <div className="tm-row">
              <label className="tm-label">Action</label>
              <select
                className="tm-select"
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value as TriggerRule['action'] })}
              >
                <option value="capture">Capture</option>
                <option value="alert">Alert only</option>
                <option value="both">Capture + Alert</option>
              </select>
            </div>
            <button className="tm-add-btn" onClick={addRule} disabled={!draft.label.trim()}>
              + Add Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
