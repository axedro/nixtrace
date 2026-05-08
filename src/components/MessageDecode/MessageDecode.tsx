import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import { DecodeTree } from './DecodeTree';
import { HexDump } from './HexDump';
import type { LadderMessage, DecodedField } from '../../types/session.types';
import './MessageDecode.css';

// ── Hex derivation for messages without rawHex ─────────────────────────────

function strToHex(s: string): string {
  let h = '';
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(2, '0');
  return h;
}

function padHex(hex: string, byteLen: number): string {
  if (hex.length / 2 >= byteLen) return hex.slice(0, byteLen * 2);
  let r = hex;
  for (let i = hex.length / 2; i < byteLen; i++)
    r += ((i * 0x1f + 0xa3) & 0xff).toString(16).padStart(2, '0');
  return r;
}

function sipHex(decoded: DecodedField[] | undefined, byteLen: number): string {
  if (!decoded?.length) return '';
  const root = decoded[0];
  const key  = root.key ?? '';

  // First line
  const codeMatch = key.match(/(\d{3})/);
  let firstLine: string;
  if (codeMatch) {
    const c = codeMatch[1];
    const phrase: Record<string, string> = { '100':'Trying','183':'Session Progress','200':'OK','401':'Unauthorized','486':'Busy Here','487':'Request Terminated' };
    firstLine = `SIP/2.0 ${c} ${phrase[c] ?? 'OK'}`;
  } else {
    const method = key.startsWith('SIP ') ? key.slice(4).split(' ')[0] : 'REGISTER';
    const uriNode = root.children?.flatMap(c => c.children ?? []).find(c => c.key === 'Request-URI');
    firstLine = `${method} ${uriNode?.value ?? 'sip:ims.rakuten.co.jp'} SIP/2.0`;
  }

  // Headers from tree
  const lines: string[] = [firstLine];
  const hdrSection = root.children?.find(c => c.key === 'Headers');
  for (const h of hdrSection?.children ?? []) {
    if (h.key && h.value !== undefined && h.value !== '') lines.push(`${h.key}: ${h.value}`);
  }
  // Top-level string fields (if no Headers section)
  if (!hdrSection) {
    for (const c of root.children ?? []) {
      if (c.type === 'string') lines.push(`${c.key}: ${c.value}`);
    }
  }
  lines.push('Content-Length: 0', '', '');

  return padHex(strToHex(lines.join('\r\n')), byteLen);
}

function http2Hex(decoded: DecodedField[] | undefined, byteLen: number): string {
  if (!decoded?.length) return '';
  const root = decoded[0];
  const hpack = root.children?.find(c => c.key === 'HPACK Headers');

  // Build a pseudo-HPACK literal block from the header fields
  const headerText = (hpack?.children ?? [])
    .filter(h => h.key && h.value !== undefined)
    .map(h => `${h.key}: ${h.value}`)
    .join('\n');
  const payloadHex = strToHex(headerText);
  const payloadLen = headerText.length;

  // HTTP/2 HEADERS frame header (9 bytes)
  const frameHdr = [
    ((payloadLen >> 16) & 0xff).toString(16).padStart(2, '0'),
    ((payloadLen >> 8)  & 0xff).toString(16).padStart(2, '0'),
    (payloadLen & 0xff).toString(16).padStart(2, '0'),
    '01', '04',             // type=HEADERS, flags=END_HEADERS
    '00', '00', '00', '01', // stream id 1
  ].join('');

  return padHex(frameHdr + payloadHex, byteLen);
}

function deriveHex(msg: LadderMessage): string {
  const raw = msg.rawHex ? msg.rawHex.replace(/\s+/g, '') : '';
  if (msg.protocol === 'SIP')   return sipHex(msg.decoded, msg.byteLen);
  if (msg.protocol === 'HTTP2') return http2Hex(msg.decoded, msg.byteLen);
  // For binary protocols: use real header bytes then pad to byteLen
  if (raw) return padHex(raw, msg.byteLen);
  return '';
}

// ── Component ──────────────────────────────────────────────────────────────

export function MessageDecode() {
  const session       = useNIxStore((s) => s.selectedSession);
  const selectedMsg   = useNIxStore((s) => s.selectedMessage);
  const selectMessage = useNIxStore((s) => s.selectMessage);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedMsg?.id]);

  if (!session) {
    return (
      <div className="md-wrap">
        <div className="md-toolbar"><span className="md-title">Message Decode</span></div>
        <div className="md-empty">Select a session to decode messages</div>
      </div>
    );
  }

  const msg: LadderMessage | null = selectedMsg ?? session.messages[0] ?? null;
  const hex = msg ? deriveHex(msg) : '';

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
              ref={m.id === msg?.id ? selectedRowRef : null}
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
            ? hex
              ? <HexDump hex={hex} />
              : <div style={{ color: 'var(--text-dim)', padding: '8px', fontSize: 12 }}>No raw capture for {msg.protocol}</div>
            : <div style={{ color: 'var(--text-dim)', padding: '8px' }}>No hex data</div>
          }
        </div>
      </div>
    </div>
  );
}
