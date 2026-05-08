import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import { DecodeTree } from './DecodeTree';
import { HexDump } from './HexDump';
import type { LadderMessage } from '../../types/session.types';
import './MessageDecode.css';

export function MessageDecode() {
  const session       = useNIxStore((s) => s.selectedSession);
  const selectedMsg   = useNIxStore((s) => s.selectedMessage);
  const selectMessage = useNIxStore((s) => s.selectMessage);

  if (!session) {
    return (
      <div className="md-wrap">
        <div className="md-toolbar"><span className="md-title">Message Decode</span></div>
        <div className="md-empty">Select a session to decode messages</div>
      </div>
    );
  }

  const msg: LadderMessage | null = selectedMsg ?? session.messages[0] ?? null;

  return (
    <div className="md-wrap">
      <div className="md-toolbar">
        <span className="md-title">Decode</span>
        {msg && (
          <span className="md-msg-tag">
            [{msg.seq}] {msg.name || msg.decoded?.[0]?.key || `Msg ${msg.seq}`} · {msg.protocol} · {msg.byteLen}B
          </span>
        )}
      </div>

      <div className="md-body">
        {/* ── Panel 1: message list ─────────────────────────────────────────── */}
        <div className="md-msglist">
          {session.messages.map((m) => (
            <div
              key={m.id}
              className={clsx('md-msg-row', {
                'md-msg-row--selected': m.id === msg?.id,
                'md-msg-row--err':      m.status === 'err',
                'md-msg-row--warn':     m.status === 'warn',
              })}
              onClick={() => selectMessage(m.id === selectedMsg?.id ? null : m)}
            >
              <span className="md-seq">{m.seq}</span>
              <span className="md-msgname">{m.name || m.decoded?.[0]?.key || `Msg ${m.seq}`}</span>
              <span className="md-proto-badge">{m.protocol}</span>
              <span className="md-byte-count">{m.byteLen}B</span>
            </div>
          ))}
        </div>

        {/* ── Panel 2: decode tree ─────────────────────────────────────────── */}
        <div className="md-decode">
          {msg
            ? <DecodeTree fields={msg.decoded} />
            : <div className="dt-empty">Click a message above</div>
          }
        </div>

        {/* ── Panel 3: hex dump ────────────────────────────────────────────── */}
        <div className="md-hex">
          {msg
            ? <HexDump hex={msg.rawHex} />
            : <div style={{ color: 'var(--text-dim)', padding: '8px' }}>No hex data</div>
          }
        </div>
      </div>
    </div>
  );
}
