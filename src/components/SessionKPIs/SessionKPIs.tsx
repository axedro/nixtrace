import { useNIxStore } from '../../store/nixStore';
import './SessionKPIs.css';

function SubscriberLink({ imsi, sessions }: { imsi: string; sessions: { imsi: string }[] }) {
  const setFilter = useNIxStore((s) => s.setFilter);
  const count = sessions.filter((s) => s.imsi === imsi).length;
  return (
    <span
      style={{ cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline dotted' }}
      title={`Show all ${count} sessions for this subscriber`}
      onClick={() => setFilter({ imsi })}
    >
      {imsi}
    </span>
  );
}

function ifacePath(messages: { iface: string }[]): string {
  const seen = new Set<string>();
  const path: string[] = [];
  messages.forEach(({ iface }) => {
    if (!seen.has(iface)) { seen.add(iface); path.push(iface); }
  });
  return path.join(' → ');
}

function relMs(messages: { timestamp: string }[], idx: number): number {
  if (idx === 0) return 0;
  try {
    const t0 = new Date(messages[0].timestamp).getTime();
    const ti = new Date(messages[idx].timestamp).getTime();
    return Math.max(0, ti - t0);
  } catch { return 0; }
}

export function SessionKPIs() {
  const session  = useNIxStore((s) => s.selectedSession);
  const sessions = useNIxStore((s) => s.sessions);

  if (!session) {
    return (
      <div className="kpi-wrap">
        <div className="kpi-toolbar"><span className="kpi-title">Session KPIs</span></div>
        <div className="kpi-empty">Select a session to view KPIs</div>
      </div>
    );
  }

  const { kpis, messages, status } = session;
  const totalMs = session.duration_ms;

  return (
    <div className="kpi-wrap">
      <div className="kpi-toolbar"><span className="kpi-title">KPIs — {session.procedure}</span></div>
      <div className="kpi-body">

        {/* Metric cards */}
        <div className="kpi-cards">
          <div className={`kpi-card${status === 'err' ? ' kpi-card--err' : ''}`}>
            <div className="kpi-card-label">Result</div>
            <div className={`kpi-card-value ${status}`}>
              {status === 'ok' ? '✓ OK' : status === 'err' ? '✗ ERR' : '⚠ WARN'}
            </div>
            {kpis.cause5gmm && (
              <div className="kpi-card-sub">{kpis.cause5gmm}</div>
            )}
          </div>

          <div className="kpi-card">
            <div className="kpi-card-label">Duration</div>
            <div className="kpi-card-value">{session.duration_ms}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span></div>
            <div className="kpi-card-sub">setup: {kpis.setupTimeMs}ms</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-label">Messages</div>
            <div className="kpi-card-value">{messages.length}</div>
            <div className="kpi-card-sub">{messages.filter(m => m.status === 'err').length} err · {messages.filter(m => m.status === 'warn').length} warn</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-label">Slice</div>
            <div className={`kpi-card-value`} style={{ color: session.slice === 'uRLLC' ? 'var(--accent-green)' : session.slice === 'eMBB' ? '#5BA3F5' : '#A78BFA' }}>
              {session.slice}
            </div>
            {kpis.throughputKbps && (
              <div className="kpi-card-sub">{Math.round(kpis.throughputKbps / 1000)} Mbps</div>
            )}
            {kpis.handoverLat !== undefined && (
              <div className="kpi-card-sub">HO: {kpis.handoverLat}ms</div>
            )}
          </div>
        </div>

        {/* Timing breakdown — 5G SA Registration + PDU */}
        {(kpis.authRttMs !== undefined || kpis.registrationMs !== undefined || kpis.pduSetupMs !== undefined) && (
          <div>
            <div className="kpi-section-title">Timing Breakdown</div>
            <div className="kpi-cards">
              {kpis.authRttMs !== undefined && (
                <div className={`kpi-card${kpis.authRttMs > 100 ? ' kpi-card--err' : ''}`}>
                  <div className="kpi-card-label">Auth RT</div>
                  <div className="kpi-card-value" style={{ color: kpis.authRttMs > 100 ? 'var(--accent-red)' : kpis.authRttMs > 50 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
                    {kpis.authRttMs}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span>
                  </div>
                  <div className="kpi-card-sub">AMF↔AUSF↔UDM</div>
                </div>
              )}
              {kpis.registrationMs !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">Registration</div>
                  <div className="kpi-card-value">{kpis.registrationMs}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span></div>
                  <div className="kpi-card-sub">RRC→NAS→NGAP</div>
                </div>
              )}
              {kpis.pduSetupMs !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">PDU Setup</div>
                  <div className="kpi-card-value">{kpis.pduSetupMs}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span></div>
                  <div className="kpi-card-sub">SMF→PCF→PFCP→UPF</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Network context */}
        {(kpis.ueIp !== undefined || kpis.sbiCalls !== undefined || kpis.pfcpExchanges !== undefined) && (
          <div>
            <div className="kpi-section-title">Network Context</div>
            <div className="kpi-cards">
              {kpis.ueIp && (
                <div className="kpi-card">
                  <div className="kpi-card-label">UE IP</div>
                  <div className="kpi-card-value" style={{ fontSize: 14 }}>{kpis.ueIp}</div>
                  <div className="kpi-card-sub">assigned by UPF</div>
                </div>
              )}
              {kpis.sbiCalls !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">SBI Calls</div>
                  <div className="kpi-card-value">{kpis.sbiCalls}</div>
                  <div className="kpi-card-sub">HTTP/2 service calls</div>
                </div>
              )}
              {kpis.pfcpExchanges !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">PFCP</div>
                  <div className="kpi-card-value">{kpis.pfcpExchanges}</div>
                  <div className="kpi-card-sub">exchanges (SMF↔UPF)</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Voice quality — VoNR */}
        {kpis.mosScore !== undefined && (
          <div>
            <div className="kpi-section-title">Voice Quality (VoNR)</div>
            <div className="kpi-cards">
              <div className={`kpi-card${kpis.mosScore < 3.5 ? ' kpi-card--err' : ''}`}>
                <div className="kpi-card-label">MOS</div>
                <div className="kpi-card-value" style={{ color: kpis.mosScore >= 4.0 ? 'var(--accent-green)' : kpis.mosScore >= 3.5 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                  {kpis.mosScore.toFixed(1)}
                </div>
                <div className="kpi-card-sub">Mean Opinion Score</div>
              </div>
              {kpis.rFactor !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">R-Factor</div>
                  <div className="kpi-card-value">{kpis.rFactor}</div>
                  <div className="kpi-card-sub">voice quality score</div>
                </div>
              )}
              {kpis.codec && (
                <div className="kpi-card">
                  <div className="kpi-card-label">Codec</div>
                  <div className="kpi-card-value" style={{ fontSize: 13 }}>{kpis.codec}</div>
                  <div className="kpi-card-sub">voice codec</div>
                </div>
              )}
              {kpis.callDurationSec !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">Call Duration</div>
                  <div className="kpi-card-value">{Math.floor(kpis.callDurationSec / 60)}m{kpis.callDurationSec % 60}s</div>
                  <div className="kpi-card-sub">active voice</div>
                </div>
              )}
              {kpis.imsSetupMs !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">IMS Reg</div>
                  <div className="kpi-card-value">{kpis.imsSetupMs}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span></div>
                  <div className="kpi-card-sub">REGISTER→200 OK</div>
                </div>
              )}
              {kpis.gbrSetupMs !== undefined && (
                <div className="kpi-card">
                  <div className="kpi-card-label">GBR Bearer</div>
                  <div className="kpi-card-value">{kpis.gbrSetupMs}<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ms</span></div>
                  <div className="kpi-card-sub">QFI=2 setup</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error banner */}
        {status === 'err' && kpis.cause5gmm && (
          <div className="kpi-err-banner">
            <span className="kpi-err-icon">✕</span>
            <span>5GMM Cause: {kpis.cause5gmm}</span>
          </div>
        )}

        {/* Context table */}
        <div>
          <div className="kpi-section-title">Session Context</div>
          <table className="kpi-ctx-table">
            <tbody>
              <tr>
      <td className="kpi-ctx-key">IMSI</td>
      <td className="kpi-ctx-val">
        <SubscriberLink imsi={session.imsi} sessions={sessions} />
      </td>
    </tr>
              {session.msisdn && <tr><td className="kpi-ctx-key">MSISDN</td><td className="kpi-ctx-val">{session.msisdn}</td></tr>}
              <tr><td className="kpi-ctx-key">gNB</td><td className="kpi-ctx-val">{session.gnb}</td></tr>
              <tr><td className="kpi-ctx-key">AMF</td><td className="kpi-ctx-val">{session.amf}</td></tr>
              {session.smf && <tr><td className="kpi-ctx-key">SMF</td><td className="kpi-ctx-val">{session.smf}</td></tr>}
              {session.upf && <tr><td className="kpi-ctx-key">UPF</td><td className="kpi-ctx-val">{session.upf}</td></tr>}
              <tr><td className="kpi-ctx-key">Interface path</td><td className="kpi-ctx-val">{ifacePath(messages)}</td></tr>
              {kpis.signalStrength !== undefined && (
                <tr><td className="kpi-ctx-key">Signal (gNB)</td><td className="kpi-ctx-val">{kpis.signalStrength} dBm</td></tr>
              )}
              {kpis.packetLoss !== undefined && (
                <tr><td className="kpi-ctx-key">Packet loss</td><td className="kpi-ctx-val">{kpis.packetLoss}%</td></tr>
              )}
              <tr><td className="kpi-ctx-key">Timestamp</td><td className="kpi-ctx-val">{session.created_at.replace('T',' ').slice(0,23)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Timeline bar */}
        <div>
          <div className="kpi-section-title">Message Timeline</div>
          <div className="kpi-timeline">
            {messages.map((m, i) => {
              const segMs  = i < messages.length - 1
                ? relMs(messages, i + 1) - relMs(messages, i)
                : 1;
              const pct    = totalMs > 0 ? (segMs / totalMs) * 100 : 100 / messages.length;
              return (
                <div
                  key={m.id}
                  className={`kpi-timeline-seg kpi-timeline-seg--${m.status}`}
                  style={{ width: `${Math.max(pct, 0.5)}%` }}
                  title={`[${m.seq}] ${m.name} +${relMs(messages, i)}ms`}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
