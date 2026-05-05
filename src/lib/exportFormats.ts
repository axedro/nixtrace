import type { Session, LadderMessage } from '../types/session.types';

// ── PCAP binary export ─────────────────────────────────────────────────────────
// Generates a valid PCAP file (libpcap format) wrapping each message's rawHex
// inside a minimal Ethernet + IPv4 + UDP frame.

function writePcapGlobalHeader(view: DataView, offset: number): number {
  view.setUint32(offset,     0xa1b2c3d4, true); // magic number (little-endian timestamps)
  view.setUint16(offset + 4, 2, true);           // major version
  view.setUint16(offset + 6, 4, true);           // minor version
  view.setInt32 (offset + 8, 0, true);           // thiszone (UTC)
  view.setUint32(offset + 12, 0, true);          // sigfigs
  view.setUint32(offset + 16, 65535, true);      // snaplen
  view.setUint32(offset + 20, 1, true);          // network: LINKTYPE_ETHERNET
  return offset + 24;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Fake Ethernet (14) + IPv4 (20) + UDP (8) = 42 bytes overhead
const ETH_HDR = new Uint8Array([
  0x00,0x11,0x22,0x33,0x44,0x55,   // dst MAC
  0x66,0x77,0x88,0x99,0xaa,0xbb,   // src MAC
  0x08,0x00,                        // EtherType: IPv4
]);

function buildFrame(payload: Uint8Array, srcIp: number[], dstIp: number[]): Uint8Array {
  const ipLen  = 20 + 8 + payload.length;
  const frame  = new Uint8Array(14 + ipLen);
  frame.set(ETH_HDR, 0);

  // IPv4 header
  frame[14] = 0x45;                  // version=4, IHL=5
  frame[15] = 0x00;                  // DSCP/ECN
  frame[16] = (ipLen >> 8) & 0xff;
  frame[17] = ipLen & 0xff;
  frame[22] = 0x40;                  // TTL=64
  frame[23] = 0x11;                  // protocol: UDP
  srcIp.forEach((b, i) => { frame[26 + i] = b; });
  dstIp.forEach((b, i) => { frame[30 + i] = b; });

  // UDP header
  frame[34] = 0x27; frame[35] = 0x10; // src port: 10000
  frame[36] = 0x27; frame[37] = 0x11; // dst port: 10001
  const udpLen = 8 + payload.length;
  frame[38] = (udpLen >> 8) & 0xff;
  frame[39] = udpLen & 0xff;

  frame.set(payload, 42);
  return frame;
}

export function sessionToPcap(session: Session): Blob {
  // Pre-calculate total size
  const msgFrames = session.messages.map((msg) => {
    const payload = hexToBytes(msg.rawHex);
    return buildFrame(payload, [10, 20, 1, 1], [10, 20, 2, 1]);
  });

  const totalSize = 24 + msgFrames.reduce((s, f) => s + 16 + f.length, 0);
  const buf  = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8   = new Uint8Array(buf);

  let offset = writePcapGlobalHeader(view, 0);

  session.messages.forEach((msg, idx) => {
    const frame = msgFrames[idx];
    const ts    = new Date(msg.timestamp).getTime();
    const tsSec = Math.floor(ts / 1000);
    const tsUs  = (ts % 1000) * 1000;

    // Packet record header
    view.setUint32(offset,      tsSec,        true);
    view.setUint32(offset + 4,  tsUs,         true);
    view.setUint32(offset + 8,  frame.length, true);
    view.setUint32(offset + 12, frame.length, true);
    offset += 16;

    u8.set(frame, offset);
    offset += frame.length;
  });

  return new Blob([buf], { type: 'application/vnd.tcpdump.pcap' });
}

// ── HTML export ────────────────────────────────────────────────────────────────

function statusBadge(s: string): string {
  const colors: Record<string, string> = { ok: '#1D9E75', err: '#E24B4A', warn: '#E5A234' };
  const c = colors[s] ?? '#7A7F8E';
  return `<span style="color:${c};font-weight:600">${s.toUpperCase()}</span>`;
}

function msgRow(m: LadderMessage): string {
  const colors: Record<string, string> = { ok: '#1D9E75', err: '#E24B4A', warn: '#E5A234' };
  const c = colors[m.status] ?? '#7A7F8E';
  return `
    <tr style="border-bottom:1px solid #2A2D36">
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.seq}</td>
      <td style="padding:4px 8px;font-family:monospace;font-size:11px">${m.timestamp.slice(11,23)}</td>
      <td style="padding:4px 8px;color:${c}">${m.name}</td>
      <td style="padding:4px 8px;color:#7A7F8E">${m.from} → ${m.to}</td>
      <td style="padding:4px 8px;color:#7A7F8E">${m.iface}</td>
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.protocol}</td>
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.byteLen}B</td>
    </tr>`;
}

export function sessionToHtml(session: Session): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NIxTrace Export — ${session.id}</title>
<style>
  body { background:#1A1D23; color:#E4E6ED; font-family:'Inter',sans-serif; font-size:13px; margin:0; padding:24px; }
  h1   { color:#1D9E75; font-size:18px; margin:0 0 4px; }
  h2   { color:#7A7F8E; font-size:12px; font-weight:500; margin:0 0 20px; letter-spacing:0.5px; text-transform:uppercase; }
  .card { background:#12141A; border:1px solid #2A2D36; border-radius:4px; padding:16px; margin-bottom:16px; }
  .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .metric-label { font-size:10px; color:#7A7F8E; text-transform:uppercase; letter-spacing:0.5px; }
  .metric-value { font-family:monospace; font-size:20px; font-weight:600; margin-top:4px; }
  table { width:100%; border-collapse:collapse; }
  td,th { text-align:left; }
  th    { font-size:10px; color:#4A4F5E; text-transform:uppercase; letter-spacing:0.5px; padding:4px 8px; }
  .hex  { font-family:monospace; font-size:10px; color:#7A7F8E; word-break:break-all; background:#0E1016; padding:8px; border-radius:3px; margin-top:8px; }
  footer { margin-top:32px; color:#4A4F5E; font-size:11px; }
</style>
</head>
<body>
<h1>NIxTrace — Session Report</h1>
<h2>5G SA Packet &amp; Session Analyzer · Rakuten Demo</h2>

<div class="card">
  <div class="grid">
    <div><div class="metric-label">Result</div><div class="metric-value" style="color:${session.status==='ok'?'#1D9E75':session.status==='err'?'#E24B4A':'#E5A234'}">${session.status.toUpperCase()}</div></div>
    <div><div class="metric-label">Procedure</div><div class="metric-value" style="font-size:14px">${session.procedure}</div></div>
    <div><div class="metric-label">Duration</div><div class="metric-value">${session.duration_ms}ms</div></div>
    <div><div class="metric-label">Slice</div><div class="metric-value">${session.slice}</div></div>
  </div>
</div>

<div class="card">
  <table>
    <tr><td style="color:#7A7F8E;padding:4px 8px;width:140px">Session ID</td><td style="font-family:monospace">${session.id}</td></tr>
    <tr><td style="color:#7A7F8E;padding:4px 8px">IMSI</td><td style="font-family:monospace">${session.imsi}</td></tr>
    <tr><td style="color:#7A7F8E;padding:4px 8px">MSISDN</td><td style="font-family:monospace">${session.msisdn ?? '—'}</td></tr>
    <tr><td style="color:#7A7F8E;padding:4px 8px">gNB</td><td style="font-family:monospace">${session.gnb}</td></tr>
    <tr><td style="color:#7A7F8E;padding:4px 8px">AMF</td><td style="font-family:monospace">${session.amf}</td></tr>
    ${session.smf ? `<tr><td style="color:#7A7F8E;padding:4px 8px">SMF</td><td style="font-family:monospace">${session.smf}</td></tr>` : ''}
    ${session.upf ? `<tr><td style="color:#7A7F8E;padding:4px 8px">UPF</td><td style="font-family:monospace">${session.upf}</td></tr>` : ''}
    <tr><td style="color:#7A7F8E;padding:4px 8px">Timestamp</td><td style="font-family:monospace">${session.created_at}</td></tr>
    ${session.kpis.cause5gmm ? `<tr><td style="color:#E24B4A;padding:4px 8px">5GMM Cause</td><td style="color:#E24B4A;font-family:monospace">${session.kpis.cause5gmm}</td></tr>` : ''}
  </table>
</div>

<div class="card">
  <h2 style="margin-bottom:12px">Message Trace (${session.messages.length} messages)</h2>
  <table>
    <tr><th>#</th><th>Time</th><th>Message</th><th>Path</th><th>Iface</th><th>Proto</th><th>Bytes</th></tr>
    ${session.messages.map(msgRow).join('')}
  </table>
</div>

${session.dpi ? `
<div class="card">
  <h2 style="margin-bottom:12px">DPI / User Plane Analysis</h2>
  <div class="grid">
    <div><div class="metric-label">Application</div><div class="metric-value" style="font-size:13px">${session.dpi.appId}</div></div>
    <div><div class="metric-label">Category</div><div class="metric-value" style="font-size:13px">${session.dpi.appCategory}</div></div>
    <div><div class="metric-label">Bytes DL</div><div class="metric-value">${(session.dpi.bytesDl/1024).toFixed(1)} KB</div></div>
    <div><div class="metric-label">Bytes UL</div><div class="metric-value">${(session.dpi.bytesUl/1024).toFixed(1)} KB</div></div>
  </div>
  ${session.dpi.mosScore !== undefined ? `<p style="margin-top:12px;color:#7A7F8E">MOS Score: <span style="color:${session.dpi.mosScore>3.5?'#1D9E75':'#E24B4A'};font-weight:600">${session.dpi.mosScore}</span></p>` : ''}
  ${session.dpi.anomalies.length > 0 ? `<p style="margin-top:8px;color:#E24B4A">⚠ Anomalies: ${session.dpi.anomalies.join(' · ')}</p>` : ''}
</div>` : ''}

<footer>Generated by NIxTrace 5G SA Analyzer · ${new Date().toISOString()} · Session ${session.id}</footer>
</body>
</html>`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
