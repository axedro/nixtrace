import type { Session, LadderMessage } from '../types/session.types';

// ── IP map: NfType → IPv4 octets ──────────────────────────────────────────────
const NF_IP: Record<string, number[]> = {
  UE:   [10,  0, 0, 1],
  gNB:  [10, 10, 1, 1],
  AMF:  [10, 20, 1, 1],
  SMF:  [10, 20, 2, 1],
  UPF:  [10, 20, 3, 1],
  AUSF: [10, 20, 4, 1],
  UDM:  [10, 20, 5, 1],
};

// ── Shared Ethernet header ─────────────────────────────────────────────────────
const ETH_HDR = new Uint8Array([
  0x00,0x11,0x22,0x33,0x44,0x55,  // dst MAC
  0x66,0x77,0x88,0x99,0xaa,0xbb,  // src MAC
  0x08,0x00,                       // EtherType: IPv4
]);

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function setIpHdr(frame: Uint8Array, ipProto: number, totalIpLen: number,
                  src: number[], dst: number[]) {
  frame[14] = 0x45;                             // version=4, IHL=5
  frame[15] = 0x00;                             // DSCP/ECN
  frame[16] = (totalIpLen >> 8) & 0xff;
  frame[17] = totalIpLen & 0xff;
  frame[20] = 0x40; frame[21] = 0x00;           // Flags+FragOffset=DF
  frame[22] = 0x40;                             // TTL=64
  frame[23] = ipProto;
  src.forEach((b, i) => { frame[26 + i] = b; });
  dst.forEach((b, i) => { frame[30 + i] = b; });
}

// ── UDP frame ─────────────────────────────────────────────────────────────────
function buildUdpFrame(payload: Uint8Array, src: number[], dst: number[],
                       srcPort: number, dstPort: number): Uint8Array {
  const ipLen   = 20 + 8 + payload.length;
  const frame   = new Uint8Array(14 + ipLen);
  frame.set(ETH_HDR, 0);
  setIpHdr(frame, 0x11, ipLen, src, dst);
  frame[34] = (srcPort >> 8) & 0xff; frame[35] = srcPort & 0xff;
  frame[36] = (dstPort >> 8) & 0xff; frame[37] = dstPort & 0xff;
  const udpLen = 8 + payload.length;
  frame[38] = (udpLen >> 8) & 0xff;  frame[39] = udpLen & 0xff;
  frame.set(payload, 42);
  return frame;
}

// ── TCP frame (minimal — PSH+ACK, no handshake) ───────────────────────────────
let tcpSeq = 0x10000000;
function buildTcpFrame(payload: Uint8Array, src: number[], dst: number[],
                       srcPort: number, dstPort: number): Uint8Array {
  const ipLen = 20 + 20 + payload.length;
  const frame = new Uint8Array(14 + ipLen);
  frame.set(ETH_HDR, 0);
  setIpHdr(frame, 0x06, ipLen, src, dst);
  frame[34] = (srcPort >> 8) & 0xff; frame[35] = srcPort & 0xff;
  frame[36] = (dstPort >> 8) & 0xff; frame[37] = dstPort & 0xff;
  const s = tcpSeq; tcpSeq += payload.length;
  frame[38] = (s >> 24) & 0xff; frame[39] = (s >> 16) & 0xff;
  frame[40] = (s >>  8) & 0xff; frame[41] = s & 0xff;
  frame[46] = 0x50;  // data offset = 5 (20 bytes)
  frame[47] = 0x18;  // PSH + ACK
  frame[48] = 0x01; frame[49] = 0xf4; // window = 500
  frame.set(payload, 54);
  return frame;
}

// ── SCTP frame (DATA chunk, complete message) ─────────────────────────────────
// PPID reference: NGAP=60, XnAP=61 (IANA SCTP PPID registry)
let sctpTsn = 1;
function buildSctpFrame(payload: Uint8Array, src: number[], dst: number[],
                        dstPort: number, ppid: number): Uint8Array {
  const padLen     = (4 - (payload.length % 4)) % 4; // 4-byte chunk alignment
  const chunkLen   = 16 + payload.length;             // not including padding
  const sctpPayLen = 16 + payload.length + padLen;
  const ipLen      = 20 + 12 + sctpPayLen;            // IP + SCTP hdr + chunk
  const frame      = new Uint8Array(14 + ipLen);

  frame.set(ETH_HDR, 0);
  setIpHdr(frame, 0x84, ipLen, src, dst); // 0x84 = SCTP (132)

  // SCTP common header (12 bytes)
  const S = 34;
  frame[S]   = 0x8E; frame[S+1] = 0xAC;  // src port: 36524 (ephemeral)
  frame[S+2] = (dstPort >> 8) & 0xff;
  frame[S+3] = dstPort & 0xff;
  // Verification tag + checksum (left as 0 — hardware offload)
  frame[S+4] = 0x12; frame[S+5] = 0x34; frame[S+6] = 0x56; frame[S+7] = 0x78;
  // checksum @ S+8..S+11 = 0x00000000

  // SCTP DATA chunk header (16 bytes)
  const C = S + 12;
  frame[C]   = 0x00;                                   // chunk type: DATA
  frame[C+1] = 0x03;                                   // B=1, E=1 (unfragmented)
  frame[C+2] = (chunkLen >> 8) & 0xff;
  frame[C+3] = chunkLen & 0xff;
  const tsn = sctpTsn++;
  frame[C+4]  = (tsn >> 24) & 0xff; frame[C+5]  = (tsn >> 16) & 0xff;
  frame[C+6]  = (tsn >>  8) & 0xff; frame[C+7]  = tsn & 0xff;
  // Stream ID = 0, Stream Seq = 0
  frame[C+12] = (ppid >> 24) & 0xff; frame[C+13] = (ppid >> 16) & 0xff;
  frame[C+14] = (ppid >>  8) & 0xff; frame[C+15] = ppid & 0xff;

  frame.set(payload, C + 16);
  return frame;
}

// ── Protocol → frame routing ──────────────────────────────────────────────────
function msgToFrame(msg: LadderMessage): Uint8Array {
  const payload = hexToBytes(msg.rawHex);
  const src = NF_IP[msg.from] ?? NF_IP.gNB;
  const dst = NF_IP[msg.to]   ?? NF_IP.AMF;

  switch (msg.protocol) {
    // NGAP / NAS live on SCTP/38412, PPID=60 (NGAP)
    case 'NGAP':
    case 'NAS':
      return buildSctpFrame(payload, src, dst, 38412, 60);

    // XnAP on SCTP/38422, PPID=61
    case 'XnAP':
      return buildSctpFrame(payload, src, dst, 38422, 61);

    // PFCP on UDP/8805 (TS 29.244)
    case 'PFCP':
      return buildUdpFrame(payload, src, dst, 8805, 8805);

    // SIP on UDP/5060 — auto-decoded by Wireshark (payload is ASCII SIP/2.0)
    case 'SIP':
      return buildUdpFrame(payload, src, dst, 5060, 5060);

    // RTP on UDP — Wireshark heuristic decodes V=2/PT=97
    case 'RTP':
      return buildUdpFrame(payload, src, dst, 49170, 49170);

    // RTCP on UDP — Wireshark heuristic decodes V=2/PT=200 SR
    case 'RTCP':
      return buildUdpFrame(payload, src, dst, 49171, 49171);

    // HTTP/2 (3GPP SBI) on TCP/8080
    case 'HTTP2': {
      const srcPort = 32768 + (sctpTsn % 16384);
      return buildTcpFrame(payload, src, dst, srcPort, 8080);
    }

    default:
      return buildUdpFrame(payload, src, dst, 10000, 10001);
  }
}

// ── PCAP global header ────────────────────────────────────────────────────────
function writePcapGlobalHeader(view: DataView, offset: number): number {
  view.setUint32(offset,      0xa1b2c3d4, true); // magic (little-endian ts)
  view.setUint16(offset +  4, 2,          true); // major version
  view.setUint16(offset +  6, 4,          true); // minor version
  view.setInt32 (offset +  8, 0,          true); // thiszone (UTC)
  view.setUint32(offset + 12, 0,          true); // sigfigs
  view.setUint32(offset + 16, 65535,      true); // snaplen
  view.setUint32(offset + 20, 1,          true); // LINKTYPE_ETHERNET
  return offset + 24;
}

// ── Public exports ────────────────────────────────────────────────────────────

export function sessionToPcap(session: Session): Blob {
  tcpSeq  = 0x10000000;
  sctpTsn = 1;

  const frames = session.messages.map(msgToFrame);
  const totalSize = 24 + frames.reduce((s, f) => s + 16 + f.length, 0);
  const buf  = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8   = new Uint8Array(buf);

  let offset = writePcapGlobalHeader(view, 0);

  session.messages.forEach((msg, idx) => {
    const frame = frames[idx];
    const ts    = new Date(msg.timestamp).getTime();
    view.setUint32(offset,      Math.floor(ts / 1000), true); // ts_sec
    view.setUint32(offset +  4, (ts % 1000) * 1000,   true); // ts_usec
    view.setUint32(offset +  8, frame.length,          true); // incl_len
    view.setUint32(offset + 12, frame.length,          true); // orig_len
    offset += 16;
    u8.set(frame, offset);
    offset += frame.length;
  });

  return new Blob([buf], { type: 'application/vnd.tcpdump.pcap' });
}

function statusColor(s: string): string {
  return s === 'ok' ? '#1D9E75' : s === 'err' ? '#E24B4A' : '#E5A234';
}

function msgRow(m: LadderMessage): string {
  const c = statusColor(m.status);
  return `
    <tr style="border-bottom:1px solid #2A2D36">
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.seq}</td>
      <td style="padding:4px 8px;font-family:monospace;font-size:11px">${m.timestamp.slice(11,23)}</td>
      <td style="padding:4px 8px;color:${c}">${m.name || m.decoded?.[0]?.key || `Msg ${m.seq}`}</td>
      <td style="padding:4px 8px;color:#7A7F8E">${m.from} → ${m.to}</td>
      <td style="padding:4px 8px;color:#7A7F8E">${m.iface}</td>
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.protocol}</td>
      <td style="padding:4px 8px;color:#7A7F8E;font-family:monospace">${m.byteLen}B</td>
    </tr>`;
}

export function sessionToHtml(session: Session): string {
  const sc = statusColor(session.status);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NIxTrace Export — ${session.id}</title>
<style>
  body  { background:#1A1D23;color:#E4E6ED;font-family:'Inter',sans-serif;font-size:13px;margin:0;padding:24px }
  h1    { color:#1D9E75;font-size:18px;margin:0 0 4px }
  h2    { color:#7A7F8E;font-size:12px;font-weight:500;margin:0 0 20px;letter-spacing:.5px;text-transform:uppercase }
  .card { background:#12141A;border:1px solid #2A2D36;border-radius:4px;padding:16px;margin-bottom:16px }
  .grid { display:grid;grid-template-columns:repeat(4,1fr);gap:12px }
  .ml   { font-size:10px;color:#7A7F8E;text-transform:uppercase;letter-spacing:.5px }
  .mv   { font-family:monospace;font-size:20px;font-weight:600;margin-top:4px }
  table { width:100%;border-collapse:collapse }
  td,th { text-align:left }
  th    { font-size:10px;color:#4A4F5E;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px }
  footer{ margin-top:32px;color:#4A4F5E;font-size:11px }
</style>
</head>
<body>
<h1>NIxTrace — Session Report</h1>
<h2>5G SA Packet &amp; Session Analyzer · Rakuten Demo</h2>
<div class="card">
  <div class="grid">
    <div><div class="ml">Result</div><div class="mv" style="color:${sc}">${session.status.toUpperCase()}</div></div>
    <div><div class="ml">Procedure</div><div class="mv" style="font-size:14px">${session.procedure}</div></div>
    <div><div class="ml">Duration</div><div class="mv">${session.duration_ms}ms</div></div>
    <div><div class="ml">Slice</div><div class="mv">${session.slice}</div></div>
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
    <div><div class="ml">Application</div><div class="mv" style="font-size:13px">${session.dpi.appId}</div></div>
    <div><div class="ml">Category</div><div class="mv" style="font-size:13px">${session.dpi.appCategory}</div></div>
    <div><div class="ml">Bytes DL</div><div class="mv">${(session.dpi.bytesDl/1024).toFixed(1)} KB</div></div>
    <div><div class="ml">Bytes UL</div><div class="mv">${(session.dpi.bytesUl/1024).toFixed(1)} KB</div></div>
  </div>
  ${session.dpi.mosScore !== undefined ? `<p style="margin-top:12px;color:#7A7F8E">MOS Score: <span style="color:${session.dpi.mosScore>3.5?'#1D9E75':'#E24B4A'};font-weight:600">${session.dpi.mosScore}</span></p>` : ''}
  ${(session.dpi.anomalies ?? []).length > 0 ? `<p style="margin-top:8px;color:#E24B4A">⚠ Anomalies: ${(session.dpi.anomalies ?? []).join(' · ')}</p>` : ''}
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
