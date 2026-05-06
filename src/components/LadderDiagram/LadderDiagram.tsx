import { useRef } from 'react';
import { saveSvgAsPng } from 'save-svg-as-png';
import { useNIxStore } from '../../store/nixStore';
import type { LadderMessage, NfNode } from '../../types/session.types';
import './LadderDiagram.css';

// All colors hardcoded — CSS variables don't survive SVG serialization
const DARK_C = {
  bg:       '#0E1016',
  bgPanel:  '#12141A',
  border:   '#2A2D36',
  ok:       '#1D9E75',
  err:      '#E24B4A',
  warn:     '#E5A234',
  blue:     '#4A90D9',
  text:     '#E4E6ED',
  textDim:  '#6A7080',
  textSec:  '#9AA0B4',
  arrow:    '#8090A8',
  lifeline: '#2A2D36',
  selected: 'rgba(29,158,117,0.08)',
} as const;

const LIGHT_C = {
  bg:       '#F4F5F8',
  bgPanel:  '#FFFFFF',
  border:   '#C8CDD8',
  ok:       '#1A8F68',
  err:      '#CC3534',
  warn:     '#B87E18',
  blue:     '#2270C8',
  text:     '#1A1D23',
  textDim:  '#7A808F',
  textSec:  '#4A5060',
  arrow:    '#5A6580',
  lifeline: '#C8CDD8',
  selected: 'rgba(29,158,117,0.10)',
} as const;

type ColorSet = { [K in keyof typeof DARK_C]: string };

const LEFT_MARGIN   = 56;
const COL_WIDTH     = 150;
const ROW_HEIGHT    = 46;
const HEADER_HEIGHT = 88;
const RIGHT_MARGIN  = 80;
const BOTTOM_PAD    = 20;

function colX(idx: number) { return LEFT_MARGIN + idx * COL_WIDTH + COL_WIDTH / 2; }
function msgY(idx: number) { return HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2; }

function arrowhead(x: number, y: number, dir: 'right' | 'left'): string {
  const s = dir === 'right' ? 1 : -1;
  return `${x},${y} ${x - s * 8},${y - 4} ${x - s * 8},${y + 4}`;
}

function colorByStatus(status: string, C: ColorSet) {
  if (status === 'err')  return C.err;
  if (status === 'warn') return C.warn;
  return C.arrow;
}

// Find NF node index, using role discriminator for Handover gNBs
function nfIndex(nfs: NfNode[], id: string, role?: 'source' | 'target'): number {
  const idx = nfs.findIndex(
    (n) => n.id === id && (role === undefined || n.role === role || n.role === undefined)
  );
  return idx === -1 ? 0 : idx;
}

function relativeMs(messages: LadderMessage[], idx: number): number {
  if (idx === 0) return 0;
  try {
    const t0 = new Date(messages[0].timestamp).getTime();
    const ti = new Date(messages[idx].timestamp).getTime();
    return Math.max(0, ti - t0);
  } catch { return 0; }
}

export function LadderDiagram() {
  const session        = useNIxStore((s) => s.selectedSession);
  const selectedMsg    = useNIxStore((s) => s.selectedMessage);
  const selectMessage  = useNIxStore((s) => s.selectMessage);
  const theme          = useNIxStore((s) => s.theme);
  const C              = theme === 'light' ? LIGHT_C : DARK_C;
  const svgRef         = useRef<SVGSVGElement>(null);

  if (!session) {
    return (
      <div className="ld-wrap">
        <div className="ld-toolbar">
          <span className="ld-title">Ladder Diagram</span>
        </div>
        <div className="ld-empty">
          <span className="ld-empty-icon">⌸</span>
          <span>Select a session to view the ladder</span>
        </div>
      </div>
    );
  }

  const { nfs, messages } = session;
  const totalWidth  = LEFT_MARGIN + nfs.length * COL_WIDTH + RIGHT_MARGIN;
  const totalHeight = HEADER_HEIGHT + messages.length * ROW_HEIGHT + BOTTOM_PAD;

  function handleExport() {
    if (!svgRef.current) return;
    saveSvgAsPng(svgRef.current, `nixtrace-${session!.id}.png`, {
      scale: 2,
      backgroundColor: C.bg,
    });
  }

  function handleMsgClick(msg: LadderMessage) {
    selectMessage(selectedMsg?.id === msg.id ? null : msg);
  }

  return (
    <div className="ld-wrap">
      <div className="ld-toolbar">
        <span className="ld-title">
          Ladder — {session.procedure}
          &nbsp;·&nbsp;
          <span style={{ color: session.status === 'ok' ? C.ok : session.status === 'err' ? C.err : C.warn }}>
            {session.status.toUpperCase()}
          </span>
        </span>
        <button className="ld-export-btn" onClick={handleExport} title="Export as PNG">
          ↓ PNG
        </button>
      </div>

      <div className="ld-scroll">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          width={totalWidth}
          height={totalHeight}
          style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {/* Background */}
          <rect width={totalWidth} height={totalHeight} fill={C.bg} />

          {/* NF column headers */}
          {nfs.map((nf, i) => {
            const x = colX(i);
            const initials = nf.id === 'gNB' ? (nf.role === 'source' ? 'gNB₁' : nf.role === 'target' ? 'gNB₂' : 'gNB') : nf.id;
            return (
              <g key={`${nf.id}-${nf.role ?? i}`}>
                {/* Circle */}
                <circle cx={x} cy={38} r={22} fill={C.bgPanel} stroke={C.border} strokeWidth={1.5} />
                <text x={x} y={43} textAnchor="middle" fill={C.text} fontSize={10} fontWeight={600}>
                  {initials}
                </text>
                {/* Label */}
                <text x={x} y={64} textAnchor="middle" fill={C.textSec} fontSize={10}>
                  {nf.label}
                </text>
                {/* IP */}
                <text x={x} y={77} textAnchor="middle" fill={C.textDim} fontSize={9}>
                  {nf.ip}
                </text>
                {/* Dashed lifeline */}
                <line
                  x1={x} y1={HEADER_HEIGHT}
                  x2={x} y2={totalHeight - BOTTOM_PAD}
                  stroke={C.lifeline}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Message rows */}
          {messages.map((msg, idx) => {
            const fromIdx = nfIndex(nfs, msg.from, msg.fromRole);
            const toIdx   = nfIndex(nfs, msg.to,   msg.toRole);
            const y       = msgY(idx);
            const fromX   = colX(fromIdx);
            const toX     = colX(toIdx);
            const midX    = (fromX + toX) / 2;
            const dir     = toX >= fromX ? 'right' : 'left';
            const color   = colorByStatus(msg.status, C);
            const isSelected = selectedMsg?.id === msg.id;
            const relMs   = relativeMs(messages, idx);

            return (
              <g
                key={msg.id}
                className={`ld-msg-row${isSelected ? ' ld-msg-row--selected' : ''}`}
                onClick={() => handleMsgClick(msg)}
              >
                {/* Hover / selected background */}
                <rect
                  className="ld-hover-rect"
                  x={0}
                  y={y - ROW_HEIGHT / 2}
                  width={totalWidth}
                  height={ROW_HEIGHT}
                  fill={isSelected ? 'rgba(29,158,117,0.08)' : 'transparent'}
                />

                {/* Left-margin timestamp */}
                <text x={4} y={y + 4} fontSize={9} fill={C.textDim} fontFamily="'JetBrains Mono', monospace">
                  {`+${relMs}`}
                </text>

                {/* Horizontal arrow line */}
                <line
                  x1={fromX}
                  y1={y}
                  x2={toX}
                  y2={y}
                  stroke={color}
                  strokeWidth={msg.status === 'err' ? 1.5 : 1}
                  strokeDasharray={msg.status === 'err' ? '6 3' : 'none'}
                />

                {/* Arrowhead */}
                <polygon
                  points={arrowhead(toX, y, dir)}
                  fill={color}
                />

                {/* Message name above line */}
                <text
                  x={midX}
                  y={y - 7}
                  textAnchor="middle"
                  fontSize={10}
                  fill={color}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={isSelected ? 600 : 400}
                >
                  {msg.name}
                </text>

                {/* Right-side iface + byte tag */}
                <text
                  x={totalWidth - 4}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={9}
                  fill={C.textDim}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {msg.iface} · {msg.byteLen}B
                </text>

                {/* Protocol badge */}
                <rect
                  x={midX - 18}
                  y={y + 4}
                  width={36}
                  height={12}
                  rx={2}
                  fill="rgba(255,255,255,0.04)"
                  stroke={C.border}
                  strokeWidth={0.5}
                />
                <text
                  x={midX}
                  y={y + 13}
                  textAnchor="middle"
                  fontSize={8}
                  fill={C.textDim}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {msg.protocol}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
