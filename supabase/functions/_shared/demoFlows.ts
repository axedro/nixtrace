// Deno-compatible version of src/data/demoFlows.ts
// All types are inlined — no imports from src/

// ─── Inline types ────────────────────────────────────────────────────────────

interface DecodedField {
  key:       string;
  value:     string | number | boolean;
  type:      'string' | 'number' | 'bool' | 'hex' | 'enum' | 'section';
  children?: DecodedField[];
  error?:    boolean;
}

interface NfNode {
  id:       string;
  label:    string;
  hostname: string;
  ip:       string;
  role?:    'source' | 'target';
}

interface LadderMessage {
  id:        string;
  seq:       number;
  timestamp: string;
  from:      string;
  fromRole?: string;
  to:        string;
  toRole?:   string;
  iface:     string;
  name:      string;
  protocol:  string;
  status:    'ok' | 'err' | 'warn';
  byteLen:   number;
  rawHex:    string;
  decoded:   DecodedField[];
}

interface SessionKpiData {
  setupTimeMs:      number;
  throughputKbps?:  number;
  signalStrength?:  number;
  packetLoss?:      number;
  handoverLat?:     number;
  cause5gmm?:       string;
  authRttMs?:       number;
  registrationMs?:  number;
  pduSetupMs?:      number;
  sbiCalls?:        number;
  pfcpExchanges?:   number;
  ueIp?:            string;
  mosScore?:        number;
  rFactor?:         number;
  codec?:           string;
  callSetupMs?:     number;
  callDurationSec?: number;
  imsSetupMs?:      number;
  gbrSetupMs?:      number;
}

export interface Session {
  id:            string;
  created_at:    string;
  timestamp:     string;
  imsi:          string;
  msisdn?:       string;
  procedure:     string;
  primary_iface: string;
  slice:         string;
  duration_ms:   number;
  status:        'ok' | 'err' | 'warn';
  gnb:           string;
  amf:           string;
  smf?:          string;
  upf?:          string;
  nfs:           NfNode[];
  messages:      LadderMessage[];
  kpis:          SessionKpiData;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function sec(label: string, fields: DecodedField[]): DecodedField {
  return { key: label, value: '', type: 'section', children: fields };
}
function str(key: string, value: string): DecodedField {
  return { key, value, type: 'string' };
}
function num(key: string, value: number): DecodedField {
  return { key, value, type: 'number' };
}
function hex(key: string, value: string): DecodedField {
  return { key, value, type: 'hex' };
}
function enm(key: string, value: string): DecodedField {
  return { key, value, type: 'enum' };
}
function boo(key: string, value: boolean): DecodedField {
  return { key, value, type: 'bool' };
}

// ─── Flow A NF nodes ────────────────────────────────────────────────────────

const NFS_5GSA: NfNode[] = [
  { id: 'UE',   label: 'UE',      hostname: 'ue-rak-001',               ip: '10.0.0.1'   },
  { id: 'gNB',  label: 'gNB-O-CU',hostname: 'gnb-rak-01.rakuten.local', ip: '10.10.1.1'  },
  { id: 'AMF',  label: 'AMF-01',  hostname: 'amf-01.core.rakuten.local', ip: '10.20.1.1'  },
  { id: 'AUSF', label: 'AUSF-01', hostname: 'ausf-01.core.rakuten.local', ip: '10.20.4.1'  },
  { id: 'UDM',  label: 'UDM-01',  hostname: 'udm-01.core.rakuten.local', ip: '10.20.5.1'  },
  { id: 'PCF',  label: 'PCF-01',  hostname: 'pcf-01.core.rakuten.local', ip: '10.20.6.1'  },
  { id: 'SMF',  label: 'SMF-01',  hostname: 'smf-01.core.rakuten.local', ip: '10.20.2.1'  },
  { id: 'UPF',  label: 'UPF-01',  hostname: 'upf-01.core.rakuten.local', ip: '10.20.3.1'  },
];

// ─── Flow B NF nodes ────────────────────────────────────────────────────────

const NFS_VONR: NfNode[] = [
  { id: 'UE',     label: 'UE-A',    hostname: 'ue-rak-001',               ip: '10.45.0.23'  },
  { id: 'gNB',    label: 'gNB-O-CU',hostname: 'gnb-rak-01.rakuten.local', ip: '10.10.1.1'   },
  { id: 'AMF',    label: 'AMF-01',  hostname: 'amf-01.core.rakuten.local', ip: '10.20.1.1'   },
  { id: 'SMF',    label: 'SMF-01',  hostname: 'smf-01.core.rakuten.local', ip: '10.20.2.1'   },
  { id: 'UPF',    label: 'UPF-01',  hostname: 'upf-01.core.rakuten.local', ip: '10.20.3.1'   },
  { id: 'P-CSCF', label: 'P-CSCF', hostname: 'pcscf.ims.rakuten.local',   ip: '10.30.1.1'   },
  { id: 'S-CSCF', label: 'S-CSCF', hostname: 'scscf.ims.rakuten.local',   ip: '10.30.2.1'   },
  { id: 'UE-B',   label: 'UE-B',   hostname: 'ue-rak-002',                ip: '10.45.0.24'  },
];

const BASE_TS_A = '2025-01-15T09:00:00.000Z';
const BASE_TS_B = '2025-01-15T10:00:00.000Z';

function ts(base: string, offsetMs: number): string {
  return new Date(new Date(base).getTime() + offsetMs).toISOString();
}

function tsA(ms: number) { return ts(BASE_TS_A, ms); }
function tsB(ms: number) { return ts(BASE_TS_B, ms); }

// ─── Flow A messages (34 messages) ──────────────────────────────────────────

const MSGS_5GSA: Omit<LadderMessage, 'id'>[] = [
  { seq: 1,  timestamp: tsA(0),   from: 'UE',   to: 'gNB',    iface: 'Uu',  protocol: 'RRC',   status: 'ok', byteLen: 18,  rawHex: '00 01 28 00 01 e0 6c 04 f7',    decoded: [sec('RRC Setup Request',   [enm('rrcSetupRequest.ue-Identity.randomValue','randomValue'), hex('randomValue','0x01E06C04F7'), enm('establishmentCause','mo-Signalling')])] },
  { seq: 2,  timestamp: tsA(2),   from: 'gNB',  to: 'UE',     iface: 'Uu',  protocol: 'RRC',   status: 'ok', byteLen: 122, rawHex: '68 20 00 08 40 01 9e 40 00 80',  decoded: [sec('RRC Setup', [sec('radioBearerConfig',[sec('srb-ToAddModList[0]',[num('srb-Identity',1)])])])] },
  { seq: 3,  timestamp: tsA(5),   from: 'UE',   to: 'gNB',    iface: 'Uu',  protocol: 'RRC',   status: 'ok', byteLen: 156, rawHex: '28 00 3e 7e 00 41',               decoded: [sec('RRC Setup Complete', [sec('dedicatedNAS-Message',[sec('NAS-5GS Registration Request',[enm('5gs-registration-type','initial-registration'), sec('5gs-mobile-identity (SUCI)',[str('mcc','440'),str('mnc','10'),str('msin','000000001')])])])])] },
  { seq: 4,  timestamp: tsA(6),   from: 'gNB',  to: 'AMF',    iface: 'N2',  protocol: 'NGAP',  status: 'ok', byteLen: 192, rawHex: '00 0f 40 78 00 00 04',             decoded: [sec('NGAP InitialUEMessage',[num('RAN-UE-NGAP-ID',1001),enm('RRCEstablishmentCause','mo-Signalling')])] },
  { seq: 5,  timestamp: tsA(8),   from: 'AMF',  to: 'UE',     iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 14,  rawHex: '7e 00 55 00 01 01',               decoded: [sec('NAS-5GS Identity Request',[enm('5gs-identity-type','SUCI')])] },
  { seq: 6,  timestamp: tsA(10),  from: 'UE',   to: 'AMF',    iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 28,  rawHex: '7e 00 56 00 0d 01',               decoded: [sec('NAS-5GS Identity Response',[sec('5gs-mobile-identity (SUCI)',[str('mcc','440'),str('mnc','10'),str('msin','000000001')])])] },
  { seq: 7,  timestamp: tsA(12),  from: 'AMF',  to: 'AUSF',   iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 87,  rawHex: '',                                decoded: [sec('HTTP/2 POST /nausf-auth/v1/ue-authentications',[str(':method','POST'),str('supiOrSuci','suci-0-440-10-0000-0-0-000000001'),str('servingNetworkName','5G:mnc010.mcc440.3gppnetwork.org')])] },
  { seq: 8,  timestamp: tsA(14),  from: 'AUSF', to: 'UDM',    iface: 'N13', protocol: 'HTTP2', status: 'ok', byteLen: 82,  rawHex: '',                                decoded: [sec('HTTP/2 POST /nudm-ueau/v1/{supiOrSuci}/security-information/generate-auth-data',[str(':method','POST')])] },
  { seq: 9,  timestamp: tsA(18),  from: 'UDM',  to: 'AUSF',   iface: 'N13', protocol: 'HTTP2', status: 'ok', byteLen: 210, rawHex: '',                                decoded: [sec('HTTP/2 200 OK',[str(':status','200'),sec('5G-HE-AV',[hex('rand','0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),hex('autn','0x1234567890ABCDEF')])])] },
  { seq: 10, timestamp: tsA(20),  from: 'AUSF', to: 'AMF',    iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 195, rawHex: '',                                decoded: [sec('HTTP/2 201 Created',[str(':status','201'),sec('5G-AV',[hex('rand','0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),hex('hxres*','0x4F5E6D7C8B9A0B1C')])])] },
  { seq: 11, timestamp: tsA(22),  from: 'AMF',  to: 'UE',     iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 110, rawHex: '7e 00 56 21 01',                  decoded: [sec('NAS-5GS Authentication Request',[hex('rand','0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),hex('autn','0x1234567890ABCDEF')])] },
  { seq: 12, timestamp: tsA(26),  from: 'UE',   to: 'AMF',    iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 42,  rawHex: '7e 00 57 2d 10',                  decoded: [sec('NAS-5GS Authentication Response',[hex('res*','0x9F8E7D6C5B4A3928')])] },
  { seq: 13, timestamp: tsA(28),  from: 'AMF',  to: 'AUSF',   iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 75,  rawHex: '',                                decoded: [sec('HTTP/2 PUT /nausf-auth/v1/ue-authentications/{authCtxId}/5g-aka-confirmation',[str(':method','PUT'),hex('resStar','0x9F8E7D6C5B4A3928')])] },
  { seq: 14, timestamp: tsA(31),  from: 'AMF',  to: 'UE',     iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 65,  rawHex: '7e 03 4e 49 c0',                  decoded: [sec('NAS-5GS Security Mode Command',[enm('ciphering','128-5G-EA1'),enm('integrity','128-5G-IA1')])] },
  { seq: 15, timestamp: tsA(34),  from: 'UE',   to: 'AMF',    iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 78,  rawHex: '7e 04 5e 00 7b',                  decoded: [sec('NAS-5GS Security Mode Complete',[str('imeisv','35902311324857800')])] },
  { seq: 16, timestamp: tsA(37),  from: 'AMF',  to: 'UDM',    iface: 'N8',  protocol: 'HTTP2', status: 'ok', byteLen: 95,  rawHex: '',                                decoded: [sec('HTTP/2 GET /nudm-sdm/v2/{supi}/am-data',[str(':method','GET')])] },
  { seq: 17, timestamp: tsA(40),  from: 'UDM',  to: 'AMF',    iface: 'N8',  protocol: 'HTTP2', status: 'ok', byteLen: 180, rawHex: '',                                decoded: [sec('HTTP/2 200 OK',[str('gpsis[0]','msisdn-819011111111'),sec('subscribedUeAmbr',[str('uplink','200 Mbps'),str('downlink','400 Mbps')])])] },
  { seq: 18, timestamp: tsA(43),  from: 'AMF',  to: 'PCF',    iface: 'N15', protocol: 'HTTP2', status: 'ok', byteLen: 145, rawHex: '',                                decoded: [sec('HTTP/2 POST /npcf-am-policy-control/v1/policies',[str(':method','POST'),str('supi','imsi-440100000000001')])] },
  { seq: 19, timestamp: tsA(47),  from: 'PCF',  to: 'AMF',    iface: 'N15', protocol: 'HTTP2', status: 'ok', byteLen: 162, rawHex: '',                                decoded: [sec('HTTP/2 201 Created',[str(':status','201')])] },
  { seq: 20, timestamp: tsA(50),  from: 'AMF',  to: 'UE',     iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 145, rawHex: '7e 02 42 01 77',                  decoded: [sec('NAS-5GS Registration Accept',[sec('5G-GUTI',[str('mcc','440'),str('mnc','10'),hex('5g-tmsi','0x00000001')]),num('T3512',54)])] },
  { seq: 21, timestamp: tsA(52),  from: 'UE',   to: 'AMF',    iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 12,  rawHex: '7e 02 43',                        decoded: [sec('NAS-5GS Registration Complete',[])] },
  { seq: 22, timestamp: tsA(55),  from: 'UE',   to: 'AMF',    iface: 'N1',  protocol: 'NAS',   status: 'ok', byteLen: 165, rawHex: '7e 02 c1 00 01',                  decoded: [sec('NAS-5GS PDU Session Establishment Request',[num('pdu-session-id',1),enm('pdu-session-type','IPv4')])] },
  { seq: 23, timestamp: tsA(57),  from: 'AMF',  to: 'SMF',    iface: 'N11', protocol: 'HTTP2', status: 'ok', byteLen: 210, rawHex: '',                                decoded: [sec('HTTP/2 POST /nsmf-pdusession/v1/sm-contexts',[str('supi','imsi-440100000000001'),str('dnn','internet.rakuten.co.jp')])] },
  { seq: 24, timestamp: tsA(59),  from: 'SMF',  to: 'UDM',    iface: 'N10', protocol: 'HTTP2', status: 'ok', byteLen: 88,  rawHex: '',                                decoded: [sec('HTTP/2 GET /nudm-sdm/v2/{supi}/sm-data',[str(':method','GET')])] },
  { seq: 25, timestamp: tsA(62),  from: 'SMF',  to: 'PCF',    iface: 'N7',  protocol: 'HTTP2', status: 'ok', byteLen: 175, rawHex: '',                                decoded: [sec('HTTP/2 POST /npcf-smpolicycontrol/v1/sm-policies',[str('dnn','internet.rakuten.co.jp'),num('pduSessionId',1)])] },
  { seq: 26, timestamp: tsA(65),  from: 'PCF',  to: 'SMF',    iface: 'N7',  protocol: 'HTTP2', status: 'ok', byteLen: 188, rawHex: '',                                decoded: [sec('HTTP/2 201 Created',[str(':status','201'),sec('pccRules.rule-1',[num('precedence',1),num('5qi',9)])])] },
  { seq: 27, timestamp: tsA(68),  from: 'SMF',  to: 'UPF',    iface: 'N4',  protocol: 'PFCP',  status: 'ok', byteLen: 342, rawHex: '21 32 01 56',                     decoded: [sec('PFCP Session Establishment Request',[sec('Create PDR[1]',[num('pdr-id',1),sec('PDI',[enm('source-interface','Access')])]),sec('Create FAR[1]',[num('far-id',1),enm('apply-action','FORW')]),sec('Create QER[1]',[num('qfi',1),enm('gate-status','OPEN/OPEN')])])] },
  { seq: 28, timestamp: tsA(71),  from: 'UPF',  to: 'SMF',    iface: 'N4',  protocol: 'PFCP',  status: 'ok', byteLen: 298, rawHex: '21 33 01 2a',                     decoded: [sec('PFCP Session Establishment Response',[sec('Cause',[enm('value','Request accepted')]),sec('Created PDR[1]',[sec('F-TEID',[str('ipv4','10.20.3.1'),hex('teid','0x00000001')]),sec('UE IP address',[str('ipv4','10.45.0.23')])])])] },
  { seq: 29, timestamp: tsA(73),  from: 'SMF',  to: 'AMF',    iface: 'N11', protocol: 'HTTP2', status: 'ok', byteLen: 195, rawHex: '',                                decoded: [sec('HTTP/2 201 Created',[str(':status','201'),str('smContextRef','/nsmf-pdusession/v1/sm-contexts/1')])] },
  { seq: 30, timestamp: tsA(76),  from: 'AMF',  to: 'gNB',    iface: 'N2',  protocol: 'NGAP',  status: 'ok', byteLen: 355, rawHex: '00 1d 40 ba',                     decoded: [sec('NGAP PDUSessionResourceSetupRequest',[num('pDUSessionID',1),sec('uL-NGU-UP-TNLInformation',[str('gTPTunnel.transportLayerAddress','10.20.3.1'),hex('gTPTunnel.gTP-TEID','0x00000001')])])] },
  { seq: 31, timestamp: tsA(80),  from: 'gNB',  to: 'UE',     iface: 'Uu',  protocol: 'RRC',   status: 'ok', byteLen: 285, rawHex: '00 08 40 02',                     decoded: [sec('RRC Reconfiguration',[sec('PDU Session Est. Accept',[sec('PDU address',[str('ipv4','10.45.0.23')]),str('DNN','internet.rakuten.co.jp')])])] },
  { seq: 32, timestamp: tsA(83),  from: 'UE',   to: 'gNB',    iface: 'Uu',  protocol: 'RRC',   status: 'ok', byteLen: 10,  rawHex: '00 08 80 01',                     decoded: [sec('RRC Reconfiguration Complete',[num('rrc-TransactionIdentifier',1)])] },
  { seq: 33, timestamp: tsA(85),  from: 'gNB',  to: 'AMF',    iface: 'N2',  protocol: 'NGAP',  status: 'ok', byteLen: 295, rawHex: '20 1d 40 72',                     decoded: [sec('NGAP PDUSessionResourceSetupResponse',[sec('dL-NGU-UP-TNLInformation',[str('gTPTunnel.transportLayerAddress','10.10.1.1'),hex('gTPTunnel.gTP-TEID','0x00000002')])])] },
  { seq: 34, timestamp: tsA(88),  from: 'UE',   to: 'UPF',    iface: 'N3',  protocol: 'GTP-U', status: 'ok', byteLen: 84,  rawHex: '30 ff 00 4c 00 00 00 01',          decoded: [sec('GTP-U header',[hex('message-type','0xFF'),num('length',76),hex('TEID','0x00000001')]),sec('IP payload',[str('src','10.45.0.23'),str('dst','8.8.8.8')])] },
];

// ─── Flow B messages (22 messages) ──────────────────────────────────────────

const MSGS_VONR: Omit<LadderMessage, 'id'>[] = [
  { seq: 1,  timestamp: tsB(0),      from: 'UE',     to: 'P-CSCF', iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 542, rawHex: '', decoded: [sec('SIP REGISTER',[str('Request-Line','REGISTER sip:ims.rakuten.co.jp SIP/2.0'),str('From','<sip:819011111111@ims.rakuten.co.jp>;tag=1234567890'),str('Expires','3600')])] },
  { seq: 2,  timestamp: tsB(3),      from: 'P-CSCF', to: 'UE',     iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 285, rawHex: '', decoded: [sec('SIP 100 Trying',[str('Status-Line','SIP/2.0 100 Trying')])] },
  { seq: 3,  timestamp: tsB(5),      from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 610, rawHex: '', decoded: [sec('SIP REGISTER (P-CSCF→S-CSCF)',[str('Route','<sip:scscf.ims.rakuten.co.jp;lr>')])] },
  { seq: 4,  timestamp: tsB(8),      from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 390, rawHex: '', decoded: [sec('SIP 401 Unauthorized',[str('Status-Line','SIP/2.0 401 Unauthorized'),str('WWW-Authenticate','Digest algorithm=AKAv1-MD5')])] },
  { seq: 5,  timestamp: tsB(10),     from: 'P-CSCF', to: 'UE',     iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 390, rawHex: '', decoded: [sec('SIP 401 Unauthorized (forwarded)',[str('Status-Line','SIP/2.0 401 Unauthorized')])] },
  { seq: 6,  timestamp: tsB(14),     from: 'UE',     to: 'P-CSCF', iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 620, rawHex: '', decoded: [sec('SIP REGISTER (authenticated)',[str('Authorization','Digest algorithm=AKAv1-MD5')])] },
  { seq: 7,  timestamp: tsB(16),     from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 680, rawHex: '', decoded: [sec('SIP REGISTER (authenticated, forwarded)',[])] },
  { seq: 8,  timestamp: tsB(20),     from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 425, rawHex: '', decoded: [sec('SIP 200 OK (REGISTER — S-CSCF→P-CSCF)',[str('Contact','<sip:819011111111@10.45.0.23:5060>;expires=3600')])] },
  { seq: 9,  timestamp: tsB(22),     from: 'P-CSCF', to: 'UE',     iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 425, rawHex: '', decoded: [sec('SIP 200 OK (REGISTER forwarded to UE)',[str('Service-Route','<sip:pcscf.ims.rakuten.co.jp;lr>,<sip:scscf.ims.rakuten.co.jp;lr>')])] },
  { seq: 10, timestamp: tsB(25),     from: 'UE',     to: 'P-CSCF', iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 892, rawHex: '', decoded: [sec('SIP INVITE',[str('Request-Line','INVITE sip:819022222222@ims.rakuten.co.jp SIP/2.0'),str('Call-ID','inv-abc123@10.45.0.23'),sec('SDP',[str('m=audio','50000 RTP/AVP 98'),str('a=rtpmap:98','AMR-WB/16000')])])] },
  { seq: 11, timestamp: tsB(30),     from: 'SMF',    to: 'PCF',    iface: 'N7',  protocol: 'HTTP2', status: 'ok', byteLen: 188, rawHex: '', decoded: [sec('HTTP/2 POST npcf-smpolicycontrol Update (GBR for VoNR)',[sec('reqQosFlows[0]',[num('qfi',2),num('fiveQI',1),sec('gbrQosFlowInfo',[str('maxFbrUl','100 kbps'),str('maxFbrDl','100 kbps')])])])] },
  { seq: 12, timestamp: tsB(33),     from: 'SMF',    to: 'UPF',    iface: 'N4',  protocol: 'PFCP',  status: 'ok', byteLen: 280, rawHex: '21 34 01 18', decoded: [sec('PFCP Session Modification Request (GBR QER QFI=2)',[sec('Create QER[2]',[num('qer-id',2),enm('gate-status','OPEN/OPEN'),num('qfi',2)])])] },
  { seq: 13, timestamp: tsB(36),     from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 960, rawHex: '', decoded: [sec('SIP INVITE (P-CSCF→S-CSCF)',[str('P-Asserted-Identity','<sip:819011111111@ims.rakuten.co.jp>')])] },
  { seq: 14, timestamp: tsB(40),     from: 'S-CSCF', to: 'UE-B',   iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 960, rawHex: '', decoded: [sec('SIP INVITE (S-CSCF→UE-B)',[str('Request-Line','INVITE sip:819022222222@10.45.0.24:5060 SIP/2.0')])] },
  { seq: 15, timestamp: tsB(2200),   from: 'P-CSCF', to: 'UE-B',   iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 245, rawHex: '', decoded: [sec('SIP ACK (forwarded to UE-B)',[str('Request-Line','ACK sip:819022222222@10.45.0.24:5060 SIP/2.0'),str('Call-ID','inv-abc123@10.45.0.23')])] },
  { seq: 16, timestamp: tsB(2212),   from: 'UE-B',   to: 'S-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 540, rawHex: '', decoded: [sec('SIP 200 OK (INVITE — UE-B answers)',[str('Status-Line','SIP/2.0 200 OK'),sec('SDP',[str('m=audio','50002 RTP/AVP 98'),str('a=rtpmap:98','AMR-WB/16000')])])] },
  { seq: 17, timestamp: tsB(2215),   from: 'SMF',    to: 'UPF',    iface: 'N4',  protocol: 'PFCP',  status: 'ok', byteLen: 195, rawHex: '21 34 00 c3', decoded: [sec('PFCP Session Modification (Activate FAR-3 for gNB TEID)',[sec('Update FAR[3]',[num('far-id',3),sec('Outer Header Creation',[str('ipv4-address','10.10.1.1'),hex('teid','0x00000002')])])])] },
  { seq: 18, timestamp: tsB(2218),   from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP',   status: 'ok', byteLen: 540, rawHex: '', decoded: [sec('SIP 200 OK (INVITE, S-CSCF→P-CSCF)',[])] },
  { seq: 19, timestamp: tsB(2220),   from: 'P-CSCF', to: 'UE',     iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 540, rawHex: '', decoded: [sec('SIP 200 OK (INVITE, P-CSCF→UE-A)',[str('Contact','<sip:819022222222@10.45.0.24:5060>')])] },
  { seq: 20, timestamp: tsB(2224),   from: 'UE',     to: 'P-CSCF', iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 220, rawHex: '', decoded: [sec('SIP ACK (UE-A→P-CSCF)',[str('Request-Line','ACK sip:819022222222@10.45.0.24:5060 SIP/2.0')])] },
  { seq: 21, timestamp: tsB(2228),   from: 'UE',     to: 'UE-B',   iface: 'N3',  protocol: 'RTP',   status: 'ok', byteLen: 172, rawHex: '80 62 00 01 00 00 00 00 12 34 56 78', decoded: [sec('RTP header',[num('payload-type',98),num('sequence-number',1),hex('SSRC','0x12345678')]),sec('RTP payload',[enm('codec','AMR-WB/16000')])] },
  { seq: 22, timestamp: tsB(144200), from: 'UE',     to: 'P-CSCF', iface: 'Gm',  protocol: 'SIP',   status: 'ok', byteLen: 280, rawHex: '', decoded: [sec('SIP BYE',[str('Request-Line','BYE sip:819022222222@10.45.0.24:5060 SIP/2.0')])] },
];

// ─── Attach IDs ─────────────────────────────────────────────────────────────

function attachIds(msgs: Omit<LadderMessage, 'id'>[], prefix: string): LadderMessage[] {
  return msgs.map((m, i) => ({ ...m, id: `${prefix}-msg-${String(i + 1).padStart(3, '0')}` }));
}

// ─── Exported base sessions ──────────────────────────────────────────────────

export const DEMO_FLOW_5GSA: Session = {
  id:            'demo-a1-base',
  created_at:    BASE_TS_A,
  timestamp:     BASE_TS_A,
  imsi:          '440100000000004',
  msisdn:        '819012345678',
  procedure:     '5G SA Registration + PDU',
  primary_iface: 'N2',
  slice:         'eMBB',
  duration_ms:   95,
  status:        'ok',
  gnb:           'gNB-RAK-01',
  amf:           'AMF-01',
  smf:           'SMF-01',
  upf:           'UPF-01',
  nfs:           NFS_5GSA,
  messages:      attachIds(MSGS_5GSA, 'a1-base'),
  kpis: {
    setupTimeMs:    95,
    authRttMs:      22,
    registrationMs: 61,
    pduSetupMs:     33,
    sbiCalls:       14,
    pfcpExchanges:  2,
    ueIp:           '10.45.0.23',
  },
};

export const DEMO_FLOW_VONR: Session = {
  id:            'demo-b1-base',
  created_at:    BASE_TS_B,
  timestamp:     BASE_TS_B,
  imsi:          '440100000000004',
  msisdn:        '819012345678',
  procedure:     'VoNR Session Setup',
  primary_iface: 'Gm',
  slice:         'eMBB',
  duration_ms:   144200,
  status:        'ok',
  gnb:           'gNB-RAK-01',
  amf:           'AMF-01',
  smf:           'SMF-01',
  upf:           'UPF-01',
  nfs:           NFS_VONR,
  messages:      attachIds(MSGS_VONR, 'b1-base'),
  kpis: {
    setupTimeMs:     2228,
    imsSetupMs:      22,
    callSetupMs:     2212,
    gbrSetupMs:      7,
    callDurationSec: 142,
    mosScore:        4.2,
    rFactor:         88,
    codec:           'AMR-WB/16000',
    sbiCalls:        4,
    pfcpExchanges:   3,
  },
  dpi: {
    appId:       'VoNR',
    appCategory: 'Voice',
    dpi_flows:   [
      { qfi: 1, fiveQI: 9, type: 'Non-GBR', pdb: 300 },
      { qfi: 2, fiveQI: 1, type: 'GBR', gbrDl: 64, gbrUl: 64, pdb: 100 },
    ],
    bytesUl:   1843200,
    bytesDl:   1843200,
    packetsUl: 10720,
    packetsDl: 10720,
    jitterMs:  2,
    latencyMs: 28,
    mosScore:  4.2,
    anomalies: [],
  },
};
