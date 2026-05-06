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

// ── NAS/PFCP byte builders (TS 24.501 / TS 29.244) ───────────────────────────

function buildSuci(imsi: string): number[] {
  const mcc  = imsi.slice(0, 3);
  const mnc  = imsi.slice(3, 5);
  const msin = imsi.slice(5);
  const m = (s: string) => s.split('').map(Number);
  const mccD = m(mcc), mncD = m(mnc);
  const bytes: number[] = [
    0x01,                               // identity type=SUCI, SUPI format=IMSI
    (mccD[1] << 4) | mccD[0],          // MCC digit2|digit1
    (0xF  << 4) | mccD[2],             // MNC digit3=F (2-digit MNC) | MCC digit3
    (mncD[1] << 4) | mncD[0],          // MNC digit2|digit1
    0xFF, 0xFF,                         // Routing Indicator (absent)
    0x00, 0x00,                         // Protection Scheme=null, HNPK ID=0
  ];
  for (let i = 0; i < msin.length; i += 2) {
    const hi = parseInt(msin[i], 10);
    const lo = i + 1 < msin.length ? parseInt(msin[i + 1], 10) : 0xF;
    bytes.push((hi << 4) | lo);
  }
  return bytes;
}

function buildGuti(): number[] {
  const bytes: number[] = [
    0x06,                  // identity type = 5G-GUTI
    0x44, 0xF0, 0x10,     // MCC=440, MNC=10 (Rakuten Japan)
    0x01, 0x02, 0x01,     // AMF Region ID, Set ID, Pointer
  ];
  for (let i = 0; i < 4; i++) bytes.push(Math.floor(Math.random() * 256));
  return bytes;
}

function generateNasRaw(msgName: string, imsi: string, byteLen: number): number[] {
  const r = () => Math.floor(Math.random() * 256);
  const bytes: number[] = [];

  if (msgName.includes('PDU Session') || msgName.includes('IMS APN')) {
    // 5GSM (TS 24.501 §9.7): EPD=0x2e
    bytes.push(0x2e, 0x05, 0x01); // EPD, PDU Session ID=5, PTI=1
    if (msgName.includes('Request') && !msgName.includes('Release'))        bytes.push(0xC1, 0x01, 0x29);
    else if (msgName.includes('Accept'))                                     bytes.push(0xC2);
    else if (msgName.includes('Release') && msgName.includes('Request'))     bytes.push(0xD1);
    else if (msgName.includes('Release') && msgName.includes('Command'))     bytes.push(0xD3);
    else if (msgName.includes('Release') && msgName.includes('Complete'))    bytes.push(0xD4);
    else if (msgName.includes('Mod') && msgName.includes('Command'))         bytes.push(0xCB);
    else if (msgName.includes('Mod'))                                        bytes.push(0xC9);
    else                                                                     bytes.push(0xC1);
  } else {
    // 5GMM (TS 24.501 §8): EPD=0x7e
    bytes.push(0x7e, 0x00);

    if (msgName === 'Registration Request') {
      bytes.push(0x41, 0x79); // msg type, ngKSI=7+reg type=initial+follow-on
      const suci = buildSuci(imsi);
      bytes.push(0x77, 0x00, suci.length, ...suci);

    } else if (msgName === 'Registration Accept') {
      bytes.push(0x42, 0x01); // msg type, 5GS reg result=3GPP
      const guti = buildGuti();
      bytes.push(0x77, 0x00, guti.length, ...guti);

    } else if (msgName === 'Registration Complete') {
      bytes.push(0x43);

    } else if (msgName.includes('Authentication Request')) {
      bytes.push(0x56, 0x70);               // msg type, ngKSI
      bytes.push(0x38, 0x02, 0x00, 0x00);   // ABBA IE
      for (let i = 0; i < 16; i++) bytes.push(r()); // RAND (16 B)
      bytes.push(0x20, 0x10);               // AUTN IEI + length=16
      for (let i = 0; i < 16; i++) bytes.push(r()); // AUTN

    } else if (msgName.includes('Authentication Response')) {
      bytes.push(0x57);
      bytes.push(0x2D, 0x10);               // RES* IEI + length=16
      for (let i = 0; i < 16; i++) bytes.push(r());

    } else if (msgName.includes('Authentication Failure')) {
      bytes.push(0x58, 0x18);               // msg type, 5GMM Cause: MAC failure

    } else if (msgName.includes('Security Mode Command')) {
      bytes.push(0x5D);
      bytes.push(0x22);                     // NAS algorithms: EA2+IA2
      bytes.push(0x70);                     // ngKSI
      bytes.push(0x21, 0x04, 0xE0, 0xE0, 0x00, 0x00); // UE 5G security cap IE

    } else if (msgName.includes('Security Mode Complete')) {
      bytes.push(0x5E);

    } else if (msgName.includes('Deregistration')) {
      bytes.push(0x45, 0x01, 0x70); // msg type, dereg type, ngKSI
      const guti = buildGuti();
      bytes.push(0x77, 0x00, guti.length, ...guti);

    } else if (msgName.includes('Service Request')) {
      bytes.push(0x4C, 0x00, 0x70); // msg type, service type, ngKSI

    } else if (msgName.includes('Service Reject')) {
      bytes.push(0x4D, 0x16); // msg type, 5GMM Cause: Congestion

    } else if (msgName.includes('Service Accept')) {
      bytes.push(0x4E);

    } else if (msgName.includes('Configuration Update') || msgName.includes('Config Update')) {
      bytes.push(0x54);

    } else {
      bytes.push(0x00); // Unknown/RRC/data-path events
    }
  }

  while (bytes.length < byteLen) bytes.push(r());
  return bytes.slice(0, byteLen);
}

function generatePfcpRaw(msgName: string, byteLen: number): number[] {
  const r = () => Math.floor(Math.random() * 256);
  let msgType: number;
  if      (msgName.includes('Deletion') && msgName.includes('Resp')) msgType = 0x37;
  else if (msgName.includes('Deletion'))                              msgType = 0x36;
  else if (msgName.includes('Mod')      && msgName.includes('Resp')) msgType = 0x35;
  else if (msgName.includes('Mod'))                                   msgType = 0x34;
  else if (msgName.includes('Resp') || msgName.includes('Response')) msgType = 0x33;
  else                                                                msgType = 0x32;

  const msgLen = Math.max(byteLen - 4, 12); // TS 29.244 §7.2.3
  const seq    = Math.floor(Math.random() * 0xFFFFFF);
  const bytes: number[] = [
    0x24,                                          // version=1, S=1 (SEID present)
    msgType,
    (msgLen >> 8) & 0xff, msgLen & 0xff,           // Message Length
    r(), r(), r(), r(), r(), r(), r(), r(),         // SEID (8 bytes)
    (seq >> 16) & 0xff, (seq >> 8) & 0xff, seq & 0xff, // Sequence Number
    0x00,                                          // Spare
  ];
  while (bytes.length < byteLen) bytes.push(r());
  return bytes.slice(0, byteLen);
}

function generateRawHex(byteLen: number, protocol: string, msgName = '', imsi = ''): string {
  const r = () => Math.floor(Math.random() * 256);
  let bytes: number[];

  if (protocol === 'NAS') {
    bytes = generateNasRaw(msgName, imsi, byteLen);

  } else if (protocol === 'NGAP') {
    // NGAP PDU: initiatingMessage (0x00) + procedure code + criticality
    bytes = [0x00, 0x04, 0x40];
    while (bytes.length < byteLen) bytes.push(r());

  } else if (protocol === 'PFCP') {
    bytes = generatePfcpRaw(msgName, byteLen);

  } else if (protocol === 'HTTP2') {
    // HTTP/2 HEADERS frame: length(3) + type(1)=0x01 + flags(1)=0x04 + stream_id(4)
    const streamId = (Math.floor(Math.random() * 127) * 2 + 1);
    bytes = [
      0x00, 0x00, 0x00,               // length placeholder
      0x01,                            // frame type: HEADERS
      0x04,                            // flags: END_HEADERS
      0x00, 0x00, (streamId >> 8) & 0x7F, streamId & 0xff,
    ];
    while (bytes.length < byteLen) bytes.push(r());

  } else if (protocol === 'XnAP') {
    bytes = [0x00, 0x24, 0x00];
    while (bytes.length < byteLen) bytes.push(r());

  } else if (protocol === 'SIP') {
    bytes = [0x53,0x49,0x50,0x2F,0x32,0x2E,0x30,0x20]; // "SIP/2.0 "
    while (bytes.length < byteLen) bytes.push(r());

  } else if (protocol === 'RTP') {
    const seq  = Math.floor(Math.random() * 65535);
    const ts   = Math.floor(Math.random() * 0xFFFFFFFF);
    const ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
    bytes = [
      0x80, 0x61,                                              // V=2, PT=97 (EVS)
      (seq  >> 8) & 0xff, seq  & 0xff,                        // Sequence Number
      (ts   >> 24) & 0xff, (ts >> 16) & 0xff, (ts >> 8) & 0xff, ts & 0xff,
      (ssrc >> 24) & 0xff, (ssrc >> 16) & 0xff, (ssrc >> 8) & 0xff, ssrc & 0xff,
    ];
    while (bytes.length < byteLen) bytes.push(r());

  } else if (protocol === 'RTCP') {
    const len  = Math.max(Math.floor(byteLen / 4) - 1, 1);
    const ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
    bytes = [
      0x80, 0xC8,                                              // V=2, PT=200 (SR)
      (len  >> 8) & 0xff, len  & 0xff,
      (ssrc >> 24) & 0xff, (ssrc >> 16) & 0xff, (ssrc >> 8) & 0xff, ssrc & 0xff,
    ];
    while (bytes.length < byteLen) bytes.push(r());

  } else {
    bytes = [0x00, 0x00];
    while (bytes.length < byteLen) bytes.push(r());
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
              { key: 'Cause', value: 'Protocol: message-not-compatible-with-receiver-state', type: 'enum' as const, error: true },
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
          { key: 'Cause', value: 'Session context not found (#64)', type: 'enum' as const, error: true },
        ] : [
          { key: 'Cause', value: 'Request accepted (#1)', type: 'enum' as const },
        ]),
      ],
    },
  ];
}

function generateSipDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  const callId  = `${Math.random().toString(36).slice(2,10)}@ims.rakuten.co.jp`;
  const cseq    = Math.floor(Math.random() * 9) + 1;
  const isReply = msgName.includes('100') || msgName.includes('183') ||
                  msgName.includes('200') || msgName.includes('4') || msgName.includes('5');
  const isBye   = msgName.includes('BYE');
  const isInvite= msgName.includes('INVITE');

  const children: DecodedField[] = [
    { key: 'SIP Version', value: 'SIP/2.0', type: 'string' },
    {
      key: isReply ? 'Status Line' : 'Request Line', value: '', type: 'section', children: isReply
        ? [
            { key: 'Status Code', value: msgName.includes('100') ? '100' : msgName.includes('183') ? '183' : msgName.includes('BYE') ? '200' : msgName.includes('486') ? '486' : '200', type: 'number' },
            { key: 'Reason Phrase', value: msgName.includes('100') ? 'Trying' : msgName.includes('183') ? 'Session Progress' : msgName.includes('486') ? 'Busy Here' : 'OK', type: 'string' },
          ]
        : [
            { key: 'Method', value: isBye ? 'BYE' : isInvite ? 'INVITE' : 'REGISTER', type: 'enum' },
            { key: 'Request-URI', value: 'sip:bob@ims.rakuten.co.jp', type: 'string' },
          ],
    },
    {
      key: 'Headers', value: '', type: 'section', children: [
        { key: 'Via', value: `SIP/2.0/UDP ue.rakuten.local;branch=z9hG4bK${Math.random().toString(36).slice(2,8)}`, type: 'string' },
        { key: 'From', value: `<sip:alice@ims.rakuten.co.jp>;tag=${Math.random().toString(36).slice(2,8)}`, type: 'string' },
        { key: 'To',   value: `<sip:bob@ims.rakuten.co.jp>`, type: 'string' },
        { key: 'Call-ID',    value: callId, type: 'string' },
        { key: 'CSeq',       value: `${cseq} ${isBye ? 'BYE' : isInvite ? 'INVITE' : 'REGISTER'}`, type: 'string' },
        { key: 'Contact',    value: '<sip:alice@10.0.0.1:5060;transport=UDP>', type: 'string' },
        { key: 'Max-Forwards', value: '70', type: 'number' },
        { key: 'Content-Type', value: isInvite ? 'application/sdp' : '', type: 'string' },
      ],
    },
  ];

  if (isInvite || (isReply && msgName.includes('200') && !isBye)) {
    children.push({
      key: 'SDP Body', value: '', type: 'section', children: [
        { key: 'v', value: '0', type: 'number' },
        { key: 'o', value: 'alice 2890844526 2890844527 IN IP4 10.0.0.1', type: 'string' },
        { key: 's', value: 'VoNR Call', type: 'string' },
        { key: 'c', value: 'IN IP4 10.0.0.1', type: 'string' },
        { key: 'm', value: 'audio 49170 RTP/AVP 97 98 0 8', type: 'string' },
        { key: 'a:rtpmap:97', value: 'EVS/16000', type: 'string' },
        { key: 'a:rtpmap:98', value: 'EVS/32000', type: 'string' },
        { key: 'a:rtpmap:0',  value: 'PCMU/8000', type: 'string' },
        { key: 'a:fmtp:97',   value: 'br=5.9-128; bw=nb-fb; ch-aw-recv=2', type: 'string' },
        { key: 'a:sendrecv',  value: 'true', type: 'bool' },
      ],
    });
  }

  if (status === 'err') {
    children.push({ key: 'Error', value: 'SIP 486 Busy Here — callee unavailable', type: 'enum', error: true });
  }
  if (status === 'warn') {
    children.push({ key: 'Warning', value: '199 Codec fallback: EVS → PCMU', type: 'string', error: true });
  }

  return [{ key: 'SIP-Message', value: msgName, type: 'section', children }];
}

function generateRtpDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  const ssrc = `0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0')}`;
  const seq  = Math.floor(Math.random() * 65535);
  return [{
    key: 'RTP-Header', value: msgName, type: 'section', children: [
      { key: 'Version',          value: '2', type: 'number' },
      { key: 'Padding',          value: 'false', type: 'bool' },
      { key: 'Extension',        value: 'false', type: 'bool' },
      { key: 'CC (CSRC count)',   value: '0', type: 'number' },
      { key: 'Marker',           value: 'false', type: 'bool' },
      { key: 'Payload Type',     value: '97 (EVS/16000)', type: 'enum' },
      { key: 'Sequence Number',  value: String(seq), type: 'number' },
      { key: 'Timestamp',        value: String(Math.floor(Math.random() * 0xFFFFFFFF)), type: 'number' },
      { key: 'SSRC',             value: ssrc, type: 'hex' },
      {
        key: 'Payload', value: '', type: 'section', children: [
          { key: 'Codec',         value: 'EVS (Enhanced Voice Services)', type: 'string' },
          { key: 'Bitrate',       value: '13.2 kbps', type: 'string' },
          { key: 'Bandwidth',     value: 'NB+WB+SWB+FB', type: 'string' },
          { key: 'Frame size',    value: '20ms', type: 'string' },
          ...(status === 'err' ? [{ key: 'Packet loss', value: 'true — stream interrupted', type: 'bool' as const, error: true }] : []),
        ],
      },
    ],
  }];
}

function generateRtcpDecoded(_msgName: string, status: SessionStatus): DecodedField[] {
  const ssrc        = `0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0')}`;
  const packetsSent = Math.floor(Math.random() * 5000) + 500;
  const octetsSent  = packetsSent * 172;
  const jitter      = status === 'ok' ? Math.floor(Math.random() * 8) : Math.floor(Math.random() * 40) + 20;
  const lostFrac    = status === 'err' ? Math.floor(Math.random() * 80) + 20 : status === 'warn' ? Math.floor(Math.random() * 15) : 0;

  return [{
    key: 'RTCP-SR', value: 'Sender Report', type: 'section', children: [
      { key: 'Version',      value: '2', type: 'number' },
      { key: 'Packet Type',  value: '200 (SR)', type: 'enum' },
      { key: 'SSRC',         value: ssrc, type: 'hex' },
      {
        key: 'Sender Info', value: '', type: 'section', children: [
          { key: 'NTP Timestamp',  value: new Date().toISOString(), type: 'string' },
          { key: 'RTP Timestamp',  value: String(Math.floor(Math.random() * 0xFFFFFFFF)), type: 'number' },
          { key: 'Packets Sent',   value: String(packetsSent), type: 'number' },
          { key: 'Octets Sent',    value: String(octetsSent), type: 'number' },
        ],
      },
      {
        key: 'Report Block', value: '', type: 'section', children: [
          { key: 'Fraction Lost',    value: `${lostFrac}/256`, type: 'number', error: lostFrac > 10 },
          { key: 'Cumulative Lost',  value: String(Math.floor(packetsSent * lostFrac / 256)), type: 'number', error: lostFrac > 10 },
          { key: 'Highest Seq',      value: String(Math.floor(Math.random() * 65535)), type: 'number' },
          { key: 'Jitter',           value: `${jitter} samples (${Math.round(jitter * 1000 / 16000)}ms)`, type: 'string', error: jitter > 20 },
          { key: 'Last SR (LSR)',    value: `0x${Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4,'0')}`, type: 'hex' },
          { key: 'Delay since LSR',  value: `${Math.floor(Math.random() * 100)}ms`, type: 'string' },
        ],
      },
    ],
  }];
}

function generateHttp2Decoded(_msgName: string, status: SessionStatus): DecodedField[] {
  const streamId = Math.floor(Math.random() * 255) * 2 + 1; // odd = client-initiated
  return [{
    key: 'HTTP2-Frame', value: 'HEADERS', type: 'section', children: [
      { key: 'Frame Type',  value: '0x01 (HEADERS)', type: 'hex' },
      { key: 'Flags',       value: '0x04 (END_HEADERS)', type: 'hex' },
      { key: 'Stream ID',   value: String(streamId), type: 'number' },
      {
        key: 'HPACK Headers', value: '', type: 'section', children: [
          { key: ':method',       value: status === 'err' ? 'GET' : 'POST', type: 'string' },
          { key: ':path',         value: `/nsmf-pdusession/v1/sm-contexts`, type: 'string' },
          { key: ':authority',    value: 'smf-01.core.rakuten.local', type: 'string' },
          { key: ':scheme',       value: 'https', type: 'string' },
          { key: 'content-type',  value: 'application/json', type: 'string' },
          { key: '3gpp-sbi-message-priority', value: '1', type: 'number' },
          ...(status === 'err' ? [
            { key: ':status', value: '400 Bad Request', type: 'enum' as const, error: true },
            { key: 'cause',   value: 'MANDATORY_IE_MISSING', type: 'enum' as const, error: true },
          ] : [
            { key: ':status', value: '201 Created', type: 'enum' as const },
          ]),
        ],
      },
    ],
  }];
}

function generateDecoded(msgName: string, protocol: string, status: SessionStatus, cause?: string): DecodedField[] {
  switch (protocol) {
    case 'NAS':   return generateNasDecoded(msgName, status, cause);
    case 'NGAP':  return generateNgapDecoded(msgName, status);
    case 'PFCP':  return generatePfcpDecoded(msgName, status);
    case 'SIP':   return generateSipDecoded(msgName, status);
    case 'RTP':   return generateRtpDecoded(msgName, status);
    case 'RTCP':  return generateRtcpDecoded(msgName, status);
    case 'HTTP2': return generateHttp2Decoded(msgName, status);
    default:
      return [{
        key: protocol, value: msgName, type: 'section', children: [
          { key: 'Status', value: status === 'err' ? 'failure' : 'success', type: 'enum', error: status === 'err' },
        ],
      }];
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
      rawHex:    generateRawHex(byteLen, tmpl.protocol, tmpl.name, imsi),
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
