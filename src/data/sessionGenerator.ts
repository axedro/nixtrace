import { format } from 'date-fns';
import { PROCEDURE_DEFS } from './procedures';
import type {
  Session, LadderMessage, DecodedField, SessionKpiData,
  ProcedureName, SliceName, SessionStatus, NfNode, DpiData, QosFlow,
} from '../types/session.types';

// ── Pools ─────────────────────────────────────────────────────────────────────

const IMSI_POOL = Array.from({ length: 50 }, (_, i) =>
  `4401000000${String(i + 1).padStart(5, '0')}`
);

const GNB_POOL = [
  { id: 'gNB-RAK-01', ip: '10.10.1.1', location: 'Shinagawa' },
  { id: 'gNB-RAK-02', ip: '10.10.1.2', location: 'Shibuya'   },
  { id: 'gNB-RAK-03', ip: '10.10.1.3', location: 'Shinjuku'  },
  { id: 'gNB-RAK-04', ip: '10.10.1.4', location: 'Akihabara' },
  { id: 'gNB-RAK-05', ip: '10.10.1.5', location: 'Roppongi'  },
];

const AMF_POOL = [
  { id: 'AMF-01', ip: '10.20.1.1' },
  { id: 'AMF-02', ip: '10.20.1.2' },
];

const SMF_POOL = [
  { id: 'SMF-01', ip: '10.20.2.1' },
  { id: 'SMF-02', ip: '10.20.2.2' },
];

const UPF_POOL = [
  { id: 'UPF-01', ip: '10.20.3.1' },
  { id: 'UPF-02', ip: '10.20.3.2' },
];

const CAUSE_5GMM: Record<string, string> = {
  '#3':  'Illegal UE (#3)',
  '#6':  'Illegal ME (#6)',
  '#11': 'PLMN not allowed (#11)',
  '#20': 'MAC failure (#20)',
  '#21': 'Synch failure (#21)',
  '#22': 'Congestion (#22)',
  '#26': 'Non-5G authentication unacceptable (#26)',
  '#72': 'Non-3GPP access to 5GCN not allowed (#72)',
};

// Weighted procedure selection
const PROCEDURE_WEIGHTS: [ProcedureName, number][] = [
  ['PDU Session Establishment', 32],
  ['Registration',              30],
  ['Handover (Xn)',             15],
  ['Service Request',            8],
  ['PDU Session Modification',   4],
  ['PDU Session Release',        3],
  ['VoNR Session Setup',         3],
  ['VoNR Session Release',       2],
  ['Deregistration',             2],
  ['Authentication Failure',     2],
  ['UE Config Update',           1],
];

const TOTAL_WEIGHT = PROCEDURE_WEIGHTS.reduce((s, [, w]) => s + w, 0);

function weightedProcedure(): ProcedureName {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const [name, w] of PROCEDURE_WEIGHTS) {
    r -= w;
    if (r <= 0) return name;
  }
  return 'PDU Session Establishment';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function jitter(base: number, pct = 0.2): number {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

function generateRawHex(byteLen: number, protocol: string): string {
  const bytes: number[] = [];
  // Protocol-specific first bytes
  if (protocol === 'NAS') {
    bytes.push(0x7e); // Extended Protocol Discriminator
    bytes.push(0x00); // Security Header: plain NAS
    bytes.push(0x41); // default: Registration Request
  } else if (protocol === 'NGAP') {
    bytes.push(0x00, 0x0f, 0x40); // NGAP initiating message
  } else if (protocol === 'PFCP') {
    bytes.push(0x21); // PFCP version 1, SEID present
    bytes.push(0x00);
  } else if (protocol === 'HTTP2') {
    bytes.push(0x00, 0x00, 0x00, 0x01, 0x04); // HTTP/2 HEADERS frame
  } else {
    bytes.push(0x00, 0x24); // XnAP
  }
  while (bytes.length < byteLen) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.slice(0, byteLen).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateNasDecoded(msgName: string, status: SessionStatus, cause?: string): DecodedField[] {
  const base: DecodedField[] = [
    {
      key: 'NAS-PDU', value: '', type: 'section', children: [
        { key: 'Extended Protocol Discriminator', value: '0x7e (5GS Mobility Management)', type: 'hex' },
        { key: 'Security Header Type', value: 'Plain NAS (0)', type: 'enum' },
        { key: 'Message Type', value: msgName, type: 'string' },
      ],
    },
  ];

  if (msgName.includes('Registration')) {
    base[0].children!.push(
      {
        key: '5GS Registration Type', value: '', type: 'section', children: [
          { key: 'Follow-on request', value: '1', type: 'number' },
          { key: 'Registration type', value: 'Initial registration (1)', type: 'enum' },
        ],
      },
      {
        key: '5GS Mobile Identity', value: '', type: 'section', children: [
          { key: 'Identity type', value: 'SUCI (1)', type: 'enum' },
          { key: 'MCC', value: '440', type: 'string' },
          { key: 'MNC', value: '10', type: 'string' },
          { key: 'Routing Indicator', value: '0x0000', type: 'hex' },
          { key: 'Protection Scheme', value: 'null-scheme (0)', type: 'enum' },
        ],
      },
      {
        key: '5GMM Capability', value: '', type: 'section', children: [
          { key: 'SMS over NAS', value: 'true', type: 'bool' },
          { key: 'HO attach', value: 'true', type: 'bool' },
          { key: 'LPP capability', value: 'true', type: 'bool' },
        ],
      }
    );
  }

  if (msgName.includes('PDU Session Est')) {
    base[0].children!.push(
      { key: 'PDU Session ID', value: '5', type: 'number' },
      {
        key: 'PDU Session Type', value: '', type: 'section', children: [
          { key: 'Type', value: 'IPv4 (1)', type: 'enum' },
        ],
      },
      { key: 'SSC Mode', value: 'SSC Mode 1', type: 'enum' },
      { key: 'S-NSSAI', value: '01-000001', type: 'string' },
      { key: 'DNN', value: 'internet.rakuten.co.jp', type: 'string' },
    );
  }

  if (msgName.includes('Authentication')) {
    base[0].children!.push(
      { key: 'RAND', value: `0x${generateRawHex(16, 'NAS')}`, type: 'hex' },
      { key: 'AUTN', value: `0x${generateRawHex(16, 'NAS')}`, type: 'hex' },
    );
  }

  if (msgName.includes('Security Mode')) {
    base[0].children!.push(
      {
        key: 'NAS Security Algorithms', value: '', type: 'section', children: [
          { key: 'Ciphering', value: '5G-EA2 (AES-CTR)', type: 'enum' },
          { key: 'Integrity', value: '5G-IA2 (AES-CMAC)', type: 'enum' },
        ],
      }
    );
  }

  if (msgName.includes('Handover')) {
    base[0].children!.push(
      { key: 'Source gNB ID', value: '0x3A1C', type: 'hex' },
      { key: 'Target gNB ID', value: '0x3A2D', type: 'hex' },
      { key: 'Handover Type', value: 'Intra-5GS (0)', type: 'enum' },
    );
  }

  // Inject error cause if status is err
  if (status === 'err') {
    const causeCode = cause ?? '#20';
    const causeText = CAUSE_5GMM[causeCode] ?? `Unknown cause (${causeCode})`;
    base[0].children!.push(
      { key: '5GMM Cause', value: causeText, type: 'enum', error: true }
    );
  }

  if (status === 'warn') {
    base[0].children!.push(
      { key: 'Warning', value: 'QoS negotiation partial — fallback applied', type: 'string', error: true }
    );
  }

  return base;
}

function generateNgapDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  return [
    {
      key: 'NGAP-PDU', value: 'InitiatingMessage', type: 'section', children: [
        { key: 'Procedure Code', value: '0x0f (InitialUEMessage)', type: 'hex' },
        { key: 'Criticality', value: 'ignore (1)', type: 'enum' },
        {
          key: 'Value', value: msgName, type: 'section', children: [
            { key: 'RAN-UE-NGAP-ID', value: String(Math.floor(Math.random() * 65535)), type: 'number' },
            { key: 'AMF-UE-NGAP-ID', value: String(Math.floor(Math.random() * 65535)), type: 'number' },
            { key: 'NAS-PDU', value: '...embedded...', type: 'hex' },
            ...(status === 'err' ? [
              { key: 'Cause', value: 'Protocol: message-not-compatible-with-receiver-state', type: 'enum', error: true },
            ] : []),
          ],
        },
      ],
    },
  ];
}

function generatePfcpDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  return [
    {
      key: 'PFCP-Message', value: msgName, type: 'section', children: [
        { key: 'Version', value: '1', type: 'number' },
        { key: 'SEID', value: `0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8,'0')}`, type: 'hex' },
        { key: 'Sequence Number', value: String(Math.floor(Math.random() * 999) + 1), type: 'number' },
        {
          key: 'PDI', value: '', type: 'section', children: [
            { key: 'Source Interface', value: 'Access (0)', type: 'enum' },
            { key: 'UE IP Address', value: `10.${60 + Math.floor(Math.random()*10)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`, type: 'string' },
          ],
        },
        ...(status === 'err' ? [
          { key: 'Cause', value: 'Session context not found (#64)', type: 'enum', error: true },
        ] : [
          { key: 'Cause', value: 'Request accepted (#1)', type: 'enum' },
        ]),
      ],
    },
  ];
}

function generateDecoded(msgName: string, protocol: string, status: SessionStatus, cause?: string): DecodedField[] {
  switch (protocol) {
    case 'NAS':   return generateNasDecoded(msgName, status, cause);
    case 'NGAP':  return generateNgapDecoded(msgName, status);
    case 'PFCP':  return generatePfcpDecoded(msgName, status);
    default:
      return [
        {
          key: protocol, value: msgName, type: 'section', children: [
            { key: 'Status', value: status === 'err' ? 'failure' : 'success', type: 'enum', error: status === 'err' },
          ],
        },
      ];
  }
}

// ── DPI generator ─────────────────────────────────────────────────────────────

const APP_MAP: Record<string, { appId: string; category: string }> = {
  'PDU Session Establishment': { appId: 'internet.general',  category: 'Web/Data' },
  'PDU Session Modification':  { appId: 'internet.general',  category: 'Web/Data' },
  'PDU Session Release':       { appId: 'internet.general',  category: 'Web/Data' },
  'Registration':              { appId: 'signaling.5g',      category: 'Signaling' },
  'Deregistration':            { appId: 'signaling.5g',      category: 'Signaling' },
  'Authentication Failure':    { appId: 'signaling.5g',      category: 'Signaling' },
  'Handover (Xn)':             { appId: 'signaling.mobility',category: 'Mobility' },
  'Service Request':           { appId: 'signaling.5g',      category: 'Signaling' },
  'UE Config Update':          { appId: 'signaling.5g',      category: 'Signaling' },
  'VoNR Session Setup':        { appId: 'voice.vonr',        category: 'VoNR/IMS' },
  'VoNR Session Release':      { appId: 'voice.vonr',        category: 'VoNR/IMS' },
};

function generateDpi(procedureName: string, slice: SliceName, status: SessionStatus): DpiData {
  const app = APP_MAP[procedureName] ?? { appId: 'unknown', category: 'Other' };
  const isVoice = procedureName.startsWith('VoNR');
  const isData  = procedureName.startsWith('PDU');
  const errFactor = status === 'err' ? 2 : status === 'warn' ? 1.3 : 1;

  const flows: QosFlow[] = isVoice ? [
    { qfi: 1, fiveQI: 1,  type: 'GBR', gbrDl: 128, gbrUl: 128, pdb: 100 },
    { qfi: 5, fiveQI: 5,  type: 'Non-GBR', pdb: 300 },
  ] : isData ? [
    { qfi: 6,  fiveQI: 6,  type: 'Non-GBR', pdb: 300 },
    { qfi: 8,  fiveQI: 8,  type: 'Non-GBR', pdb: 300 },
    ...(slice === 'uRLLC' ? [{ qfi: 2, fiveQI: 2, type: 'GBR' as const, gbrDl: 50000, gbrUl: 10000, pdb: 10 }] : []),
  ] : [
    { qfi: 5, fiveQI: 5, type: 'Non-GBR', pdb: 300 },
  ];

  const bytesBase = isVoice ? 28000 : isData ? 450000 : 12000;
  const anomalies: string[] = [];
  if (status === 'err')  anomalies.push('Session establishment failure');
  if (status === 'warn') anomalies.push('QoS negotiation degraded');
  if (slice === 'uRLLC' && errFactor > 1) anomalies.push('Latency SLA breach (>10ms)');

  return {
    appId:       app.appId,
    appCategory: app.category,
    dpi_flows:   flows,
    bytesUl:     Math.round(jitter(bytesBase * 0.3) * errFactor),
    bytesDl:     Math.round(jitter(bytesBase * 0.7) * errFactor),
    packetsUl:   Math.round(jitter(bytesBase * 0.3 / 1400)),
    packetsDl:   Math.round(jitter(bytesBase * 0.7 / 1400)),
    jitterMs:    isVoice ? jitter(isData ? 5 : 2) : undefined,
    latencyMs:   slice === 'uRLLC' ? jitter(8) : isVoice ? jitter(35) : undefined,
    mosScore:    isVoice
      ? parseFloat((status === 'err' ? 1.2 + Math.random() : status === 'warn' ? 2.8 + Math.random() * 0.7 : 4.1 + Math.random() * 0.4).toFixed(2))
      : undefined,
    anomalies,
  };
}

// ── Main generator ─────────────────────────────────────────────────────────────

export function generateSession(): Session {
  const procedureName = weightedProcedure();
  const def = PROCEDURE_DEFS[procedureName];

  // Status draw
  const r = Math.random();
  let sessionStatus: SessionStatus =
    procedureName === 'Authentication Failure' ? 'err' :
    r < 0.08 ? 'err' :
    r < 0.13 ? 'warn' : 'ok';

  const gnbEntry  = pick(GNB_POOL);
  const amfEntry  = pick(AMF_POOL);
  const smfEntry  = pick(SMF_POOL);
  const upfEntry  = pick(UPF_POOL);
  const imsi      = pick(IMSI_POOL);
  const imsiIdx   = IMSI_POOL.indexOf(imsi);

  // Slice selection: Handover is always uRLLC or eMBB
  const availSlices = def.slices as SliceName[];
  let slice: SliceName = pick(availSlices);

  // uRLLC handovers must be sub-40ms
  const baseDuration = slice === 'uRLLC' && procedureName === 'Handover (Xn)'
    ? Math.floor(Math.random() * 10) + 28
    : jitter(def.baseDurationMs);

  const cause5gmm = sessionStatus === 'err' ? pick(Object.keys(CAUSE_5GMM)) : undefined;

  // Build NF columns
  const nfColumns: NfNode[] = def.nfFactory(
    gnbEntry.id, amfEntry.id, amfEntry.ip, smfEntry.id, smfEntry.ip, upfEntry.id, upfEntry.ip
  );

  // Build messages with relative timestamps
  const startTime  = Date.now() - jitter(50);
  let cumMs        = 0;
  const msgDelays  = [0, ...def.messages.slice(1).map(() => 5 + Math.floor(Math.random() * 35))];
  const errorPoint = def.messages.findIndex(m => m.isErrorPoint);

  const messages: LadderMessage[] = def.messages.map((tmpl, idx) => {
    cumMs += msgDelays[idx];
    const msgTs = new Date(startTime + cumMs).toISOString();

    // Determine message status
    let msgStatus: SessionStatus = 'ok';
    if (sessionStatus === 'err') {
      if (procedureName === 'Authentication Failure') {
        msgStatus = idx >= 2 ? 'err' : 'ok';
      } else if (idx >= errorPoint && errorPoint >= 0) {
        msgStatus = idx === errorPoint ? 'err' : 'ok';
      }
    } else if (sessionStatus === 'warn' && idx >= errorPoint && errorPoint >= 0) {
      msgStatus = idx === errorPoint ? 'warn' : 'ok';
    }

    const byteLen = jitter(tmpl.baseByteLen);
    return {
      id:        uid(),
      seq:       tmpl.seq,
      timestamp: msgTs,
      from:      tmpl.from,
      fromRole:  tmpl.fromRole,
      to:        tmpl.to,
      toRole:    tmpl.toRole,
      iface:     tmpl.iface,
      name:      tmpl.name,
      protocol:  tmpl.protocol,
      status:    msgStatus,
      byteLen,
      rawHex:    generateRawHex(byteLen, tmpl.protocol),
      decoded:   generateDecoded(tmpl.name, tmpl.protocol, msgStatus, cause5gmm),
    };
  });

  const msisdn = `+81-90-${String(3000 + imsiIdx).slice(-4)}-${String(5000 + imsiIdx * 7 % 9999).padStart(4, '0')}`;

  const sessionId = uid();
  const now       = new Date();

  const kpis: SessionKpiData = {
    setupTimeMs:     jitter(baseDuration * 0.4),
    throughputKbps:  slice !== 'mMTC' ? jitter(15000) : undefined,
    signalStrength:  -(60 + Math.floor(Math.random() * 25)),
    packetLoss:      sessionStatus === 'ok' ? 0 : parseFloat((Math.random() * 4).toFixed(2)),
    handoverLat:     procedureName === 'Handover (Xn)' ? baseDuration : undefined,
    cause5gmm:       cause5gmm ? CAUSE_5GMM[cause5gmm] : undefined,
  };

  const dpi = generateDpi(procedureName, slice, sessionStatus);

  return {
    id:            sessionId,
    created_at:    now.toISOString(),
    timestamp:     format(now, 'HH:mm:ss.SSS'),
    imsi,
    msisdn,
    procedure:     procedureName,
    primary_iface: def.primaryIface,
    slice,
    duration_ms:   baseDuration,
    status:        sessionStatus,
    gnb:           gnbEntry.id,
    amf:           amfEntry.id,
    smf:           smfEntry.id,
    upf:           upfEntry.id,
    nfs:           nfColumns,
    messages,
    kpis,
    dpi,
  };
}
