import clsx from 'clsx';
import { useNIxStore } from '../../store/nixStore';
import type { QosFlow } from '../../types/session.types';
import './DPIPanel.css';

function fmt(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtKbps(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} kbps`;
}

function QosRow({ flow }: { flow: QosFlow }) {
  return (
    <tr>
      <td style={{ color: 'var(--accent-blue)' }}>{flow.qfi}</td>
      <td>{flow.fiveQI}</td>
      <td>
        <span className={`dpi-gbr-badge dpi-gbr-badge--${flow.type === 'GBR' ? 'gbr' : 'nongbr'}`}>
          {flow.type}
        </span>
      </td>
      <td>{flow.gbrDl !== undefined ? fmtKbps(flow.gbrDl) : '—'}</td>
      <td>{flow.gbrUl !== undefined ? fmtKbps(flow.gbrUl) : '—'}</td>
      <td style={{ color: flow.pdb <= 10 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
        {flow.pdb}ms
      </td>
    </tr>
  );
}

export function DPIPanel() {
  const session = useNIxStore((s) => s.selectedSession);

  if (!session) {
    return (
      <div className="dpi-wrap">
        <div className="dpi-toolbar"><span className="dpi-title">DPI / User Plane</span></div>
        <div className="dpi-empty">Select a session to view DPI analysis</div>
      </div>
    );
  }

  const dpi = session.dpi;

  if (!dpi) {
    return (
      <div className="dpi-wrap">
        <div className="dpi-toolbar"><span className="dpi-title">DPI / User Plane</span></div>
        <div className="dpi-empty">No DPI data available for this session</div>
      </div>
    );
  }

  const totalBytes  = dpi.bytesDl + dpi.bytesUl;
  const dlPct       = totalBytes > 0 ? (dpi.bytesDl / totalBytes) * 100 : 50;
  const ulPct       = totalBytes > 0 ? (dpi.bytesUl / totalBytes) * 100 : 50;
  const dlKbps      = Math.round(dpi.bytesDl * 8 / Math.max(session.duration_ms, 1));
  const ulKbps      = Math.round(dpi.bytesUl * 8 / Math.max(session.duration_ms, 1));

  const mosClass = dpi.mosScore !== undefined
    ? dpi.mosScore >= 4.0 ? 'dpi-mos--good' : dpi.mosScore >= 3.0 ? 'dpi-mos--ok' : 'dpi-mos--bad'
    : '';

  return (
    <div className="dpi-wrap">
      <div className="dpi-toolbar">
        <span className="dpi-title">DPI / User Plane</span>
        <span className="dpi-app-tag">{dpi.appId} · {dpi.appCategory}</span>
      </div>

      <div className="dpi-body">
        {/* Metric cards */}
        <div className="dpi-cards">
          <div className="dpi-card">
            <div className="dpi-card-label">Total Traffic</div>
            <div className="dpi-card-value">{fmt(totalBytes)}</div>
            <div className="dpi-card-sub">↓{fmt(dpi.bytesDl)} ↑{fmt(dpi.bytesUl)}</div>
          </div>

          <div className="dpi-card">
            <div className="dpi-card-label">Packets</div>
            <div className="dpi-card-value">{dpi.packetsDl + dpi.packetsUl}</div>
            <div className="dpi-card-sub">↓{dpi.packetsDl} ↑{dpi.packetsUl}</div>
          </div>

          {dpi.latencyMs !== undefined ? (
            <div className="dpi-card">
              <div className="dpi-card-label">Latency</div>
              <div className="dpi-card-value" style={{ color: dpi.latencyMs <= 10 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                {dpi.latencyMs}ms
              </div>
              <div className="dpi-card-sub">{session.slice === 'uRLLC' ? 'uRLLC SLA: ≤10ms' : 'eMBB target'}</div>
            </div>
          ) : (
            <div className="dpi-card">
              <div className="dpi-card-label">Throughput DL</div>
              <div className="dpi-card-value">{fmtKbps(dlKbps)}</div>
              <div className="dpi-card-sub">UL: {fmtKbps(ulKbps)}</div>
            </div>
          )}

          {dpi.mosScore !== undefined ? (
            <div className="dpi-card">
              <div className="dpi-card-label">MOS Score</div>
              <div className={clsx('dpi-card-value dpi-mos', mosClass)}>{dpi.mosScore}</div>
              <div className="dpi-card-sub">
                {dpi.mosScore >= 4.0 ? 'Excellent' : dpi.mosScore >= 3.5 ? 'Good' : dpi.mosScore >= 3.0 ? 'Fair' : 'Poor'}
                {dpi.jitterMs !== undefined ? ` · ${dpi.jitterMs}ms jitter` : ''}
              </div>
            </div>
          ) : (
            <div className="dpi-card">
              <div className="dpi-card-label">QoS Flows</div>
              <div className="dpi-card-value">{dpi.dpi_flows.length}</div>
              <div className="dpi-card-sub">{dpi.dpi_flows.filter(f => f.type === 'GBR').length} GBR</div>
            </div>
          )}
        </div>

        {/* Throughput bar */}
        <div>
          <div className="dpi-section-title">Throughput Distribution</div>
          <div className="dpi-throughput">
            <div className="dpi-th-row">
              <span className="dpi-th-label" style={{ color: 'var(--accent-blue)' }}>DL</span>
              <div className="dpi-th-bar-wrap">
                <div className="dpi-th-bar dpi-th-bar--dl" style={{ width: `${dlPct}%` }} />
              </div>
              <span className="dpi-th-val">{fmtKbps(dlKbps)}</span>
            </div>
            <div className="dpi-th-row">
              <span className="dpi-th-label" style={{ color: 'var(--accent-green)' }}>UL</span>
              <div className="dpi-th-bar-wrap">
                <div className="dpi-th-bar dpi-th-bar--ul" style={{ width: `${ulPct}%` }} />
              </div>
              <span className="dpi-th-val">{fmtKbps(ulKbps)}</span>
            </div>
          </div>
        </div>

        {/* QoS flows */}
        <div>
          <div className="dpi-section-title">QoS Flows (QFI mapping)</div>
          <table className="dpi-flow-table">
            <thead>
              <tr>
                <th>QFI</th><th>5QI</th><th>Type</th><th>GBR DL</th><th>GBR UL</th><th>PDB</th>
              </tr>
            </thead>
            <tbody>
              {dpi.dpi_flows.map((f) => <QosRow key={f.qfi} flow={f} />)}
            </tbody>
          </table>
        </div>

        {/* Anomalies */}
        {dpi.anomalies.length > 0 && (
          <div>
            <div className="dpi-section-title">Anomaly Detection</div>
            <div className="dpi-anomalies">
              {dpi.anomalies.map((a, i) => (
                <div key={i} className="dpi-anomaly">
                  <span>⚠</span> {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
