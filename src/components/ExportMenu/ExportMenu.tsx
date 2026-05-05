import { useState, useRef, useEffect } from 'react';
import { useNIxStore } from '../../store/nixStore';
import { sessionToPcap, sessionToHtml, downloadBlob } from '../../lib/exportFormats';
import './ExportMenu.css';

export function ExportMenu() {
  const session = useNIxStore((s) => s.selectedSession);
  const [open, setOpen]   = useState(false);
  const [toast, setToast] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function handlePcap() {
    if (!session) return;
    const blob = sessionToPcap(session);
    downloadBlob(blob, `nixtrace-${session.id}.pcap`);
    notify('PCAP saved');
    setOpen(false);
  }

  function handleHtml() {
    if (!session) return;
    const html = sessionToHtml(session);
    const blob = new Blob([html], { type: 'text/html' });
    downloadBlob(blob, `nixtrace-${session.id}.html`);
    notify('HTML report saved');
    setOpen(false);
  }

  function handleXsif() {
    if (!session) return;
    // XSIF = 3GPP XML Session Interchange Format (stub — structure is correct)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SessionRecord xmlns="urn:3gpp:xsif:1.0" sessionId="${session.id}">
  <SessionInfo>
    <IMSI>${session.imsi}</IMSI>
    <MSISDN>${session.msisdn ?? ''}</MSISDN>
    <Procedure>${session.procedure}</Procedure>
    <Status>${session.status}</Status>
    <Slice>${session.slice}</Slice>
    <DurationMs>${session.duration_ms}</DurationMs>
    <Timestamp>${session.created_at}</Timestamp>
  </SessionInfo>
  <NetworkElements>
    <gNB>${session.gnb}</gNB>
    <AMF>${session.amf}</AMF>
    <SMF>${session.smf ?? ''}</SMF>
    <UPF>${session.upf ?? ''}</UPF>
  </NetworkElements>
  <Messages count="${session.messages.length}">
    ${session.messages.map((m) => `<Message seq="${m.seq}" name="${m.name}" protocol="${m.protocol}" iface="${m.iface}" status="${m.status}" bytes="${m.byteLen}"/>`).join('\n    ')}
  </Messages>
</SessionRecord>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    downloadBlob(blob, `nixtrace-${session.id}.xsif`);
    notify('XSIF saved');
    setOpen(false);
  }

  return (
    <div className="em-wrap" ref={ref}>
      <button
        className="em-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={!session}
        title={session ? 'Export session' : 'Select a session first'}
      >
        ↓ Export
      </button>

      {open && (
        <div className="em-dropdown">
          <div className="em-header">Export — {session?.procedure}</div>
          <button className="em-item" onClick={handlePcap}>
            <span className="em-icon">⬡</span>
            <span>
              <strong>PCAP</strong>
              <small>Wireshark-compatible packet capture</small>
            </span>
          </button>
          <button className="em-item" onClick={handleHtml}>
            <span className="em-icon">◈</span>
            <span>
              <strong>HTML Report</strong>
              <small>Full session report with DPI data</small>
            </span>
          </button>
          <button className="em-item" onClick={handleXsif}>
            <span className="em-icon">◇</span>
            <span>
              <strong>XSIF</strong>
              <small>3GPP XML Session Interchange Format</small>
            </span>
          </button>
        </div>
      )}

      {toast && <div className="em-toast">{toast}</div>}
    </div>
  );
}
