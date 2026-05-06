// Supabase Edge Function — generates ~45 synthetic 5G SA sessions per invocation
// Triggered every minute by .github/workflows/seed.yml via HTTP POST
// Authorization: Bearer <SUPABASE_SERVICE_KEY>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──────────────────────────────────────────────────────────────────────

type NfType = 'UE' | 'gNB' | 'AMF' | 'SMF' | 'UPF' | 'AUSF' | 'UDM';
type Protocol = 'NAS' | 'NGAP' | 'PFCP' | 'HTTP2' | 'XnAP' | 'SIP' | 'RTP' | 'RTCP';
type InterfaceName = 'Uu' | 'N1' | 'N2' | 'N4' | 'N11' | 'NG' | 'Xn';
type SessionStatus = 'ok' | 'err' | 'warn';
type SliceName = 'eMBB' | 'uRLLC' | 'mMTC';
type ProcedureName =
  | 'Registration' | 'PDU Session Establishment' | 'PDU Session Modification'
  | 'PDU Session Release' | 'Deregistration' | 'Authentication Failure'
  | 'Handover (Xn)' | 'Service Request' | 'UE Config Update'
  | 'VoNR Session Setup' | 'VoNR Session Release';

interface NfNode { id: NfType; label: string; hostname: string; ip: string; role?: 'source' | 'target'; }
interface DecodedField { key: string; value: string; type: string; error?: boolean; children?: DecodedField[]; }
interface LadderMessage {
  id: string; seq: number; timestamp: string;
  from: NfType; fromRole?: 'source' | 'target';
  to: NfType; toRole?: 'source' | 'target';
  iface: InterfaceName; name: string; protocol: Protocol;
  status: SessionStatus; byteLen: number; rawHex: string;
  decoded: DecodedField[];
}
interface QosFlow { qfi: number; fiveQI: number; type: 'GBR' | 'Non-GBR'; gbrDl?: number; gbrUl?: number; pdb?: number; }
interface DpiData {
  appId: string; appCategory: string; dpi_flows: QosFlow[];
  bytesUl: number; bytesDl: number; packetsUl: number; packetsDl: number;
  jitterMs?: number; latencyMs?: number; mosScore?: number; anomalies: string[];
}
interface SessionKpiData {
  setupTimeMs: number; throughputKbps?: number; signalStrength: number;
  packetLoss: number; handoverLat?: number; cause5gmm?: string;
}

// ── Pools ──────────────────────────────────────────────────────────────────────

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

// ── Procedure definitions ──────────────────────────────────────────────────────

interface MsgTmpl {
  seq: number; from: NfType; fromRole?: 'source'|'target';
  to: NfType; toRole?: 'source'|'target';
  iface: InterfaceName; name: string; protocol: Protocol;
  baseByteLen: number; isErrorPoint: boolean;
}

interface ProcDef {
  name: ProcedureName;
  nfFactory: (gnb: string, amfId: string, amfIp: string, smfId?: string, smfIp?: string, upfId?: string, upfIp?: string) => NfNode[];
  messages: MsgTmpl[];
  slices: SliceName[];
  primaryIface: InterfaceName;
  baseDurationMs: number;
}

function nfUE(gnb: string): NfNode { return { id:'UE', label:'UE', hostname:`ue-${gnb.toLowerCase()}`, ip:'10.0.0.1' }; }
function nfGNB(label: string, ip: string, role?: 'source'|'target'): NfNode { return { id:'gNB', label, hostname:`${label.toLowerCase()}.rakuten.local`, ip, role }; }
function nfAMF(label: string, ip: string): NfNode { return { id:'AMF', label, hostname:`${label.toLowerCase()}.core.rakuten.local`, ip }; }
function nfSMF(label: string, ip: string): NfNode { return { id:'SMF', label, hostname:`${label.toLowerCase()}.core.rakuten.local`, ip }; }
function nfUPF(label: string, ip: string): NfNode { return { id:'UPF', label, hostname:`${label.toLowerCase()}.core.rakuten.local`, ip }; }
function nfAUSF(): NfNode { return { id:'AUSF', label:'AUSF', hostname:'ausf-01.core.rakuten.local', ip:'10.20.4.1' }; }
function nfUDM(): NfNode  { return { id:'UDM',  label:'UDM',  hostname:'udm-01.core.rakuten.local',  ip:'10.20.5.1' }; }

const PROCS: Record<ProcedureName, ProcDef> = {
  'Registration': {
    name: 'Registration',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfAUSF(), nfUDM()],
    messages: [
      { seq:1,  from:'UE',   to:'gNB',  iface:'Uu', name:'Registration Request',       protocol:'NAS',   baseByteLen:120, isErrorPoint:false },
      { seq:2,  from:'gNB',  to:'AMF',  iface:'NG', name:'Initial UE Message (NG)',     protocol:'NGAP',  baseByteLen:180, isErrorPoint:false },
      { seq:3,  from:'AMF',  to:'AUSF', iface:'N2', name:'Nausf_UEAuthentication',      protocol:'HTTP2', baseByteLen:95,  isErrorPoint:false },
      { seq:4,  from:'AUSF', to:'UDM',  iface:'N2', name:'Nudm_UEAuthentication_Get',   protocol:'HTTP2', baseByteLen:85,  isErrorPoint:false },
      { seq:5,  from:'AMF',  to:'UE',   iface:'N1', name:'Authentication Request',      protocol:'NAS',   baseByteLen:110, isErrorPoint:true  },
      { seq:6,  from:'UE',   to:'AMF',  iface:'N1', name:'Authentication Response',     protocol:'NAS',   baseByteLen:105, isErrorPoint:false },
      { seq:7,  from:'AMF',  to:'AUSF', iface:'N2', name:'Nausf_UEAuthentication Conf', protocol:'HTTP2', baseByteLen:88,  isErrorPoint:false },
      { seq:8,  from:'AMF',  to:'UE',   iface:'N1', name:'Security Mode Command',       protocol:'NAS',   baseByteLen:98,  isErrorPoint:false },
      { seq:9,  from:'UE',   to:'AMF',  iface:'N1', name:'Security Mode Complete',      protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
      { seq:10, from:'AMF',  to:'UDM',  iface:'N2', name:'Nudm_UECM_Registration',      protocol:'HTTP2', baseByteLen:120, isErrorPoint:false },
      { seq:11, from:'AMF',  to:'UE',   iface:'N1', name:'Registration Accept',         protocol:'NAS',   baseByteLen:145, isErrorPoint:false },
      { seq:12, from:'UE',   to:'AMF',  iface:'N1', name:'Registration Complete',       protocol:'NAS',   baseByteLen:65,  isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC','mMTC'], primaryIface:'N1', baseDurationMs:180,
  },

  'PDU Session Establishment': {
    name: 'PDU Session Establishment',
    nfFactory: (g,a,ai,s,si,u,ui) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfSMF(s!,si!), nfUPF(u!,ui!)],
    messages: [
      { seq:1,  from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Est. Request',       protocol:'NAS',   baseByteLen:155, isErrorPoint:false },
      { seq:2,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_CreateSMContext', protocol:'HTTP2', baseByteLen:200, isErrorPoint:false },
      { seq:3,  from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Est. Request',      protocol:'PFCP',  baseByteLen:320, isErrorPoint:false },
      { seq:4,  from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Est. Response',     protocol:'PFCP',  baseByteLen:280, isErrorPoint:false },
      { seq:5,  from:'SMF', to:'AMF', iface:'N11', name:'PDU Session Created (N11)',       protocol:'HTTP2', baseByteLen:180, isErrorPoint:false },
      { seq:6,  from:'AMF', to:'gNB', iface:'NG',  name:'PDU Session Resource Setup Req', protocol:'NGAP',  baseByteLen:340, isErrorPoint:false },
      { seq:7,  from:'gNB', to:'AMF', iface:'NG',  name:'PDU Session Resource Setup Rsp', protocol:'NGAP',  baseByteLen:295, isErrorPoint:true  },
      { seq:8,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_UpdateSMContext', protocol:'HTTP2', baseByteLen:160, isErrorPoint:false },
      { seq:9,  from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Est. Accept',        protocol:'NAS',   baseByteLen:175, isErrorPoint:false },
      { seq:10, from:'UE',  to:'UPF', iface:'Uu',  name:'UE Data Path Established',       protocol:'NAS',   baseByteLen:60,  isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC','mMTC'], primaryIface:'N11', baseDurationMs:220,
  },

  'PDU Session Modification': {
    name: 'PDU Session Modification',
    nfFactory: (g,a,ai,s,si) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfSMF(s!,si!)],
    messages: [
      { seq:1, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Mod. Request',       protocol:'NAS',   baseByteLen:130, isErrorPoint:false },
      { seq:2, from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_UpdateSMContext', protocol:'HTTP2', baseByteLen:185, isErrorPoint:false },
      { seq:3, from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Mod. Request',      protocol:'PFCP',  baseByteLen:260, isErrorPoint:false },
      { seq:4, from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Mod. Response',     protocol:'PFCP',  baseByteLen:210, isErrorPoint:false },
      { seq:5, from:'SMF', to:'AMF', iface:'N11', name:'PDU Mod. Decision (N11)',         protocol:'HTTP2', baseByteLen:145, isErrorPoint:true  },
      { seq:6, from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Mod. Command',       protocol:'NAS',   baseByteLen:160, isErrorPoint:false },
      { seq:7, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Mod. Complete',      protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC'], primaryIface:'N11', baseDurationMs:140,
  },

  'PDU Session Release': {
    name: 'PDU Session Release',
    nfFactory: (g,a,ai,s,si,u,ui) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfSMF(s!,si!), nfUPF(u!,ui!)],
    messages: [
      { seq:1, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Release Request',    protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
      { seq:2, from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_ReleaseSMContext',protocol:'HTTP2', baseByteLen:155, isErrorPoint:false },
      { seq:3, from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Deletion Request',  protocol:'PFCP',  baseByteLen:185, isErrorPoint:false },
      { seq:4, from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Deletion Response', protocol:'PFCP',  baseByteLen:140, isErrorPoint:true  },
      { seq:5, from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Release Command',    protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
      { seq:6, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Release Complete',   protocol:'NAS',   baseByteLen:80,  isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC','mMTC'], primaryIface:'N11', baseDurationMs:120,
  },

  'Deregistration': {
    name: 'Deregistration',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai)],
    messages: [
      { seq:1, from:'UE',  to:'AMF', iface:'N1', name:'Deregistration Request (UE init)', protocol:'NAS',  baseByteLen:95,  isErrorPoint:false },
      { seq:2, from:'AMF', to:'UE',  iface:'N1', name:'Deregistration Accept',            protocol:'NAS',  baseByteLen:65,  isErrorPoint:false },
      { seq:3, from:'AMF', to:'gNB', iface:'N2', name:'UE Context Release Command',       protocol:'NGAP', baseByteLen:120, isErrorPoint:false },
      { seq:4, from:'gNB', to:'AMF', iface:'N2', name:'UE Context Release Complete',      protocol:'NGAP', baseByteLen:95,  isErrorPoint:false },
      { seq:5, from:'UE',  to:'gNB', iface:'Uu', name:'RRC Release',                     protocol:'NAS',  baseByteLen:55,  isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC','mMTC'], primaryIface:'N1', baseDurationMs:90,
  },

  'Authentication Failure': {
    name: 'Authentication Failure',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfAUSF()],
    messages: [
      { seq:1, from:'UE',  to:'AMF',  iface:'N1', name:'Registration Request',        protocol:'NAS',   baseByteLen:120, isErrorPoint:false },
      { seq:2, from:'gNB', to:'AMF',  iface:'NG', name:'Initial UE Message (NG)',      protocol:'NGAP',  baseByteLen:180, isErrorPoint:false },
      { seq:3, from:'AMF', to:'AUSF', iface:'N2', name:'Nausf_UEAuthentication',       protocol:'HTTP2', baseByteLen:95,  isErrorPoint:false },
      { seq:4, from:'AMF', to:'UE',   iface:'N1', name:'Authentication Request',       protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
      { seq:5, from:'UE',  to:'AMF',  iface:'N1', name:'Authentication Failure (MAC)', protocol:'NAS',   baseByteLen:88,  isErrorPoint:true  },
    ],
    slices: ['eMBB','uRLLC','mMTC'], primaryIface:'N1', baseDurationMs:55,
  },

  'Handover (Xn)': {
    name: 'Handover (Xn)',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(`${g}-SRC`,'10.10.1.1','source'), nfGNB(`${g}-TGT`,'10.10.2.1','target'), nfAMF(a,ai)],
    messages: [
      { seq:1, from:'gNB', fromRole:'source', to:'gNB', toRole:'target', iface:'Xn', name:'Handover Request',            protocol:'XnAP', baseByteLen:380, isErrorPoint:false },
      { seq:2, from:'gNB', fromRole:'target', to:'gNB', toRole:'source', iface:'Xn', name:'Handover Request Ack',         protocol:'XnAP', baseByteLen:310, isErrorPoint:false },
      { seq:3, from:'UE',  to:'gNB',          toRole:'target',           iface:'Uu', name:'RRC Reconfiguration Complete', protocol:'NAS',  baseByteLen:85,  isErrorPoint:false },
      { seq:4, from:'gNB', fromRole:'target',  to:'AMF',                 iface:'NG', name:'Path Switch Request',          protocol:'NGAP', baseByteLen:295, isErrorPoint:false },
      { seq:5, from:'AMF', to:'gNB',           toRole:'target',          iface:'NG', name:'Path Switch Request Ack',      protocol:'NGAP', baseByteLen:265, isErrorPoint:true  },
      { seq:6, from:'gNB', fromRole:'target',  to:'gNB', toRole:'source',iface:'Xn', name:'UE Context Release',           protocol:'XnAP', baseByteLen:120, isErrorPoint:false },
    ],
    slices: ['uRLLC','eMBB'], primaryIface:'Xn', baseDurationMs:38,
  },

  'Service Request': {
    name: 'Service Request',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai)],
    messages: [
      { seq:1, from:'UE',  to:'AMF', iface:'N1', name:'Service Request',               protocol:'NAS',  baseByteLen:98,  isErrorPoint:false },
      { seq:2, from:'gNB', to:'AMF', iface:'NG', name:'Initial UE Message (Service)',   protocol:'NGAP', baseByteLen:155, isErrorPoint:false },
      { seq:3, from:'AMF', to:'gNB', iface:'NG', name:'Initial Context Setup Request',  protocol:'NGAP', baseByteLen:280, isErrorPoint:false },
      { seq:4, from:'AMF', to:'UE',  iface:'N1', name:'Service Reject (Congestion)',    protocol:'NAS',  baseByteLen:88,  isErrorPoint:true  },
      { seq:5, from:'gNB', to:'AMF', iface:'NG', name:'Initial Context Setup Rsp',     protocol:'NGAP', baseByteLen:235, isErrorPoint:false },
      { seq:6, from:'AMF', to:'UE',  iface:'N1', name:'Service Accept',                protocol:'NAS',  baseByteLen:110, isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC'], primaryIface:'N1', baseDurationMs:100,
  },

  'UE Config Update': {
    name: 'UE Config Update',
    nfFactory: (g,a,ai) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai)],
    messages: [
      { seq:1, from:'AMF', to:'UE',  iface:'N1', name:'Configuration Update Command',  protocol:'NAS', baseByteLen:145, isErrorPoint:false },
      { seq:2, from:'UE',  to:'AMF', iface:'N1', name:'Config Update Complete',        protocol:'NAS', baseByteLen:88,  isErrorPoint:false },
      { seq:3, from:'AMF', to:'UE',  iface:'N1', name:'Config Update Command (NACK)',  protocol:'NAS', baseByteLen:95,  isErrorPoint:true  },
      { seq:4, from:'UE',  to:'AMF', iface:'N1', name:'Config Update NACK',            protocol:'NAS', baseByteLen:75,  isErrorPoint:false },
    ],
    slices: ['eMBB','mMTC'], primaryIface:'N1', baseDurationMs:75,
  },

  'VoNR Session Setup': {
    name: 'VoNR Session Setup',
    nfFactory: (g,a,ai,s,si) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfSMF(s!,si!)],
    messages: [
      { seq:1,  from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Est. (IMS APN)',   protocol:'NAS',   baseByteLen:165, isErrorPoint:false },
      { seq:2,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession Create (IMS)', protocol:'HTTP2', baseByteLen:210, isErrorPoint:false },
      { seq:3,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP REGISTER',                protocol:'SIP',   baseByteLen:540, isErrorPoint:false },
      { seq:4,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 100 Trying',              protocol:'SIP',   baseByteLen:280, isErrorPoint:false },
      { seq:5,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 200 OK (REGISTER)',       protocol:'SIP',   baseByteLen:420, isErrorPoint:false },
      { seq:6,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP INVITE',                  protocol:'SIP',   baseByteLen:680, isErrorPoint:true  },
      { seq:7,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 183 Session Progress',    protocol:'SIP',   baseByteLen:380, isErrorPoint:false },
      { seq:8,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 200 OK (INVITE)',         protocol:'SIP',   baseByteLen:510, isErrorPoint:false },
      { seq:9,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP ACK',                     protocol:'SIP',   baseByteLen:220, isErrorPoint:false },
      { seq:10, from:'UE',  to:'SMF', iface:'N4',  name:'RTP Stream Established',      protocol:'RTP',   baseByteLen:172, isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC'], primaryIface:'N1', baseDurationMs:320,
  },

  'VoNR Session Release': {
    name: 'VoNR Session Release',
    nfFactory: (g,a,ai,s,si) => [nfUE(g), nfGNB(g,'10.10.1.1'), nfAMF(a,ai), nfSMF(s!,si!)],
    messages: [
      { seq:1, from:'UE',  to:'AMF', iface:'N1',  name:'SIP BYE',                    protocol:'SIP',   baseByteLen:280, isErrorPoint:false },
      { seq:2, from:'AMF', to:'UE',  iface:'N1',  name:'SIP 200 OK (BYE)',           protocol:'SIP',   baseByteLen:240, isErrorPoint:false },
      { seq:3, from:'UE',  to:'SMF', iface:'N4',  name:'RTCP BYE',                   protocol:'RTCP',  baseByteLen:64,  isErrorPoint:false },
      { seq:4, from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession Release IMS', protocol:'HTTP2', baseByteLen:165, isErrorPoint:true  },
      { seq:5, from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Release Command', protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
    ],
    slices: ['eMBB','uRLLC'], primaryIface:'N1', baseDurationMs:95,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function uid(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
function jitter(base: number, pct = 0.2): number { return Math.round(base * (1 + (Math.random() * 2 - 1) * pct)); }
function rand256(): number { return Math.floor(Math.random() * 256); }
function toHex(bytes: number[]): string { return bytes.map(b => b.toString(16).padStart(2, '0')).join(''); }

function weightedProcedure(): ProcedureName {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const [name, w] of PROCEDURE_WEIGHTS) { r -= w; if (r <= 0) return name; }
  return 'PDU Session Establishment';
}

// ── Raw byte builders ──────────────────────────────────────────────────────────

function buildSuci(imsi: string): number[] {
  const mcc = imsi.slice(0,3); const mnc = imsi.slice(3,5); const msin = imsi.slice(5);
  const m = (s: string) => s.split('').map(Number);
  const mccD = m(mcc); const mncD = m(mnc);
  const bytes: number[] = [
    0x01, (mccD[1]<<4)|mccD[0], (0xF<<4)|mccD[2], (mncD[1]<<4)|mncD[0], 0xFF, 0xFF, 0x00, 0x00,
  ];
  for (let i = 0; i < msin.length; i+=2) {
    const hi = parseInt(msin[i], 10);
    const lo = i+1 < msin.length ? parseInt(msin[i+1], 10) : 0xF;
    bytes.push((hi<<4)|lo);
  }
  return bytes;
}

function buildGuti(): number[] {
  const bytes: number[] = [0x06, 0x44, 0xF0, 0x10, 0x01, 0x02, 0x01];
  for (let i = 0; i < 4; i++) bytes.push(rand256());
  return bytes;
}

function generateNasRaw(msgName: string, imsi: string, byteLen: number): number[] {
  const r = rand256; const bytes: number[] = [];
  if (msgName.includes('PDU Session') || msgName.includes('IMS APN')) {
    bytes.push(0x2e, 0x05, 0x01);
    if (msgName.includes('Request') && !msgName.includes('Release')) bytes.push(0xC1, 0x01, 0x29);
    else if (msgName.includes('Accept'))                              bytes.push(0xC2);
    else if (msgName.includes('Release') && msgName.includes('Request')) bytes.push(0xD1);
    else if (msgName.includes('Release') && msgName.includes('Command'))  bytes.push(0xD3);
    else if (msgName.includes('Release') && msgName.includes('Complete')) bytes.push(0xD4);
    else if (msgName.includes('Mod') && msgName.includes('Command'))      bytes.push(0xCB);
    else if (msgName.includes('Mod'))                                     bytes.push(0xC9);
    else bytes.push(0xC1);
  } else {
    bytes.push(0x7e, 0x00);
    if (msgName === 'Registration Request') {
      bytes.push(0x41, 0x79); const suci = buildSuci(imsi); bytes.push(0x77, 0x00, suci.length, ...suci);
    } else if (msgName === 'Registration Accept') {
      bytes.push(0x42, 0x01); const guti = buildGuti(); bytes.push(0x77, 0x00, guti.length, ...guti);
    } else if (msgName === 'Registration Complete') {
      bytes.push(0x43);
    } else if (msgName.includes('Authentication Request')) {
      bytes.push(0x56, 0x70, 0x38, 0x02, 0x00, 0x00);
      for (let i=0; i<16; i++) bytes.push(r()); bytes.push(0x20, 0x10);
      for (let i=0; i<16; i++) bytes.push(r());
    } else if (msgName.includes('Authentication Response')) {
      bytes.push(0x57, 0x2D, 0x10); for (let i=0; i<16; i++) bytes.push(r());
    } else if (msgName.includes('Authentication Failure')) {
      bytes.push(0x58, 0x18);
    } else if (msgName.includes('Security Mode Command')) {
      bytes.push(0x5D, 0x22, 0x70, 0x21, 0x04, 0xE0, 0xE0, 0x00, 0x00);
    } else if (msgName.includes('Security Mode Complete')) {
      bytes.push(0x5E);
    } else if (msgName.includes('Deregistration')) {
      bytes.push(0x45, 0x01, 0x70); const guti = buildGuti(); bytes.push(0x77, 0x00, guti.length, ...guti);
    } else if (msgName.includes('Service Request')) {
      bytes.push(0x4C, 0x00, 0x70);
    } else if (msgName.includes('Service Reject')) {
      bytes.push(0x4D, 0x16);
    } else if (msgName.includes('Service Accept')) {
      bytes.push(0x4E);
    } else if (msgName.includes('Configuration Update') || msgName.includes('Config Update')) {
      bytes.push(0x54);
    } else {
      bytes.push(0x00);
    }
  }
  while (bytes.length < byteLen) bytes.push(r());
  return bytes.slice(0, byteLen);
}

function generatePfcpRaw(msgName: string, byteLen: number): number[] {
  const r = rand256;
  let msgType = 0x32;
  if      (msgName.includes('Deletion') && msgName.includes('Resp')) msgType = 0x37;
  else if (msgName.includes('Deletion'))                              msgType = 0x36;
  else if (msgName.includes('Mod')      && msgName.includes('Resp')) msgType = 0x35;
  else if (msgName.includes('Mod'))                                   msgType = 0x34;
  else if (msgName.includes('Resp') || msgName.includes('Response')) msgType = 0x33;

  const msgLen = Math.max(byteLen - 4, 12);
  const seq    = Math.floor(Math.random() * 0xFFFFFF);
  const bytes: number[] = [
    0x24, msgType, (msgLen>>8)&0xff, msgLen&0xff,
    r(), r(), r(), r(), r(), r(), r(), r(),
    (seq>>16)&0xff, (seq>>8)&0xff, seq&0xff, 0x00,
  ];
  while (bytes.length < byteLen) bytes.push(r());
  return bytes.slice(0, byteLen);
}

function generateRawHex(byteLen: number, protocol: Protocol, msgName = '', imsi = ''): string {
  const r = rand256; let bytes: number[];
  if (protocol === 'NAS') {
    bytes = generateNasRaw(msgName, imsi, byteLen);
  } else if (protocol === 'NGAP') {
    bytes = [0x00, 0x04, 0x40]; while (bytes.length < byteLen) bytes.push(r());
  } else if (protocol === 'PFCP') {
    bytes = generatePfcpRaw(msgName, byteLen);
  } else if (protocol === 'HTTP2') {
    const sid = (Math.floor(Math.random()*127)*2+1);
    bytes = [0x00,0x00,0x00,0x01,0x04,0x00,0x00,(sid>>8)&0x7F,sid&0xff];
    while (bytes.length < byteLen) bytes.push(r());
  } else if (protocol === 'XnAP') {
    bytes = [0x00, 0x24, 0x00]; while (bytes.length < byteLen) bytes.push(r());
  } else if (protocol === 'SIP') {
    bytes = [0x53,0x49,0x50,0x2F,0x32,0x2E,0x30,0x20]; while (bytes.length < byteLen) bytes.push(r());
  } else if (protocol === 'RTP') {
    const seq = Math.floor(Math.random()*65535); const ts = Math.floor(Math.random()*0xFFFFFFFF); const ssrc = Math.floor(Math.random()*0xFFFFFFFF);
    bytes = [0x80,0x61,(seq>>8)&0xff,seq&0xff,(ts>>24)&0xff,(ts>>16)&0xff,(ts>>8)&0xff,ts&0xff,(ssrc>>24)&0xff,(ssrc>>16)&0xff,(ssrc>>8)&0xff,ssrc&0xff];
    while (bytes.length < byteLen) bytes.push(r());
  } else if (protocol === 'RTCP') {
    const len = Math.max(Math.floor(byteLen/4)-1,1); const ssrc = Math.floor(Math.random()*0xFFFFFFFF);
    bytes = [0x80,0xC8,(len>>8)&0xff,len&0xff,(ssrc>>24)&0xff,(ssrc>>16)&0xff,(ssrc>>8)&0xff,ssrc&0xff];
    while (bytes.length < byteLen) bytes.push(r());
  } else {
    bytes = [0x00,0x00]; while (bytes.length < byteLen) bytes.push(r());
  }
  return toHex(bytes.slice(0, byteLen));
}

// ── Decoded field generators ───────────────────────────────────────────────────

function generateNasDecoded(msgName: string, status: SessionStatus, cause?: string): DecodedField[] {
  const base: DecodedField[] = [{
    key:'NAS-PDU', value:'', type:'section', children:[
      { key:'Extended Protocol Discriminator', value:'0x7e (5GS Mobility Management)', type:'hex' },
      { key:'Security Header Type', value:'Plain NAS (0)', type:'enum' },
      { key:'Message Type', value:msgName, type:'string' },
    ],
  }];
  if (msgName.includes('Registration')) {
    base[0].children!.push(
      { key:'5GS Registration Type', value:'', type:'section', children:[
        { key:'Follow-on request', value:'1', type:'number' },
        { key:'Registration type', value:'Initial registration (1)', type:'enum' },
      ]},
      { key:'5GS Mobile Identity', value:'', type:'section', children:[
        { key:'Identity type', value:'SUCI (1)', type:'enum' },
        { key:'MCC', value:'440', type:'string' }, { key:'MNC', value:'10', type:'string' },
        { key:'Routing Indicator', value:'0x0000', type:'hex' },
        { key:'Protection Scheme', value:'null-scheme (0)', type:'enum' },
      ]},
    );
  }
  if (msgName.includes('PDU Session Est')) {
    base[0].children!.push(
      { key:'PDU Session ID', value:'5', type:'number' },
      { key:'PDU Session Type', value:'', type:'section', children:[{ key:'Type', value:'IPv4 (1)', type:'enum' }]},
      { key:'SSC Mode', value:'SSC Mode 1', type:'enum' },
      { key:'DNN', value:'internet.rakuten.co.jp', type:'string' },
    );
  }
  if (msgName.includes('Authentication')) {
    base[0].children!.push(
      { key:'RAND', value:`0x${generateRawHex(16,'NAS')}`, type:'hex' },
      { key:'AUTN', value:`0x${generateRawHex(16,'NAS')}`, type:'hex' },
    );
  }
  if (status === 'err') {
    const code = cause ?? '#20';
    base[0].children!.push({ key:'5GMM Cause', value:CAUSE_5GMM[code]??`Unknown (${code})`, type:'enum', error:true });
  }
  if (status === 'warn') {
    base[0].children!.push({ key:'Warning', value:'QoS negotiation partial — fallback applied', type:'string', error:true });
  }
  return base;
}

function generateNgapDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  return [{
    key:'NGAP-PDU', value:'InitiatingMessage', type:'section', children:[
      { key:'Procedure Code', value:'0x0f (InitialUEMessage)', type:'hex' },
      { key:'Criticality', value:'ignore (1)', type:'enum' },
      { key:'Value', value:msgName, type:'section', children:[
        { key:'RAN-UE-NGAP-ID', value:String(Math.floor(Math.random()*65535)), type:'number' },
        { key:'AMF-UE-NGAP-ID', value:String(Math.floor(Math.random()*65535)), type:'number' },
        { key:'NAS-PDU', value:'...embedded...', type:'hex' },
        ...(status==='err' ? [{ key:'Cause', value:'Protocol: message-not-compatible-with-receiver-state', type:'enum', error:true }] : []),
      ]},
    ],
  }];
}

function generatePfcpDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  return [{
    key:'PFCP-Message', value:msgName, type:'section', children:[
      { key:'Version', value:'1', type:'number' },
      { key:'SEID', value:`0x${Math.floor(Math.random()*0xFFFFFFFF).toString(16).padStart(8,'0')}`, type:'hex' },
      { key:'Sequence Number', value:String(Math.floor(Math.random()*999)+1), type:'number' },
      { key:'PDI', value:'', type:'section', children:[
        { key:'Source Interface', value:'Access (0)', type:'enum' },
        { key:'UE IP Address', value:`10.${60+Math.floor(Math.random()*10)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`, type:'string' },
      ]},
      ...(status==='err' ? [{ key:'Cause', value:'Session context not found (#64)', type:'enum', error:true }] : [{ key:'Cause', value:'Request accepted (#1)', type:'enum' }]),
    ],
  }];
}

function generateSipDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  const callId = `${Math.random().toString(36).slice(2,10)}@ims.rakuten.co.jp`;
  const cseq   = Math.floor(Math.random()*9)+1;
  const isReply  = msgName.includes('100')||msgName.includes('183')||msgName.includes('200')||msgName.includes('4')||msgName.includes('5');
  const isBye    = msgName.includes('BYE');
  const isInvite = msgName.includes('INVITE');
  const children: DecodedField[] = [
    { key:'SIP Version', value:'SIP/2.0', type:'string' },
    { key:isReply?'Status Line':'Request Line', value:'', type:'section', children:isReply
      ? [{ key:'Status Code', value:msgName.includes('100')?'100':msgName.includes('183')?'183':'200', type:'number' },
         { key:'Reason Phrase', value:msgName.includes('100')?'Trying':msgName.includes('183')?'Session Progress':'OK', type:'string' }]
      : [{ key:'Method', value:isBye?'BYE':isInvite?'INVITE':'REGISTER', type:'enum' },
         { key:'Request-URI', value:'sip:bob@ims.rakuten.co.jp', type:'string' }],
    },
    { key:'Headers', value:'', type:'section', children:[
      { key:'Via',     value:`SIP/2.0/UDP ue.rakuten.local;branch=z9hG4bK${Math.random().toString(36).slice(2,8)}`, type:'string' },
      { key:'From',    value:`<sip:alice@ims.rakuten.co.jp>;tag=${Math.random().toString(36).slice(2,8)}`, type:'string' },
      { key:'To',      value:'<sip:bob@ims.rakuten.co.jp>', type:'string' },
      { key:'Call-ID', value:callId, type:'string' },
      { key:'CSeq',    value:`${cseq} ${isBye?'BYE':isInvite?'INVITE':'REGISTER'}`, type:'string' },
      { key:'Contact', value:'<sip:alice@10.0.0.1:5060;transport=UDP>', type:'string' },
    ]},
  ];
  if (status==='err') children.push({ key:'Error', value:'SIP 486 Busy Here — callee unavailable', type:'enum', error:true });
  return [{ key:'SIP-Message', value:msgName, type:'section', children }];
}

function generateRtpDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  return [{
    key:'RTP-Header', value:msgName, type:'section', children:[
      { key:'Version', value:'2', type:'number' },
      { key:'Payload Type', value:'97 (EVS/16000)', type:'enum' },
      { key:'Sequence Number', value:String(Math.floor(Math.random()*65535)), type:'number' },
      { key:'SSRC', value:`0x${Math.floor(Math.random()*0xFFFFFFFF).toString(16).padStart(8,'0')}`, type:'hex' },
      { key:'Payload', value:'', type:'section', children:[
        { key:'Codec', value:'EVS (Enhanced Voice Services)', type:'string' },
        { key:'Bitrate', value:'13.2 kbps', type:'string' },
        ...(status==='err' ? [{ key:'Packet loss', value:'true — stream interrupted', type:'bool', error:true }] : []),
      ]},
    ],
  }];
}

function generateRtcpDecoded(msgName: string, status: SessionStatus): DecodedField[] {
  const jitter = status==='ok' ? Math.floor(Math.random()*8) : Math.floor(Math.random()*40)+20;
  const lost   = status==='err' ? Math.floor(Math.random()*80)+20 : 0;
  return [{
    key:'RTCP-SR', value:'Sender Report', type:'section', children:[
      { key:'Version', value:'2', type:'number' },
      { key:'Packet Type', value:'200 (SR)', type:'enum' },
      { key:'Jitter', value:`${jitter} samples (${Math.round(jitter*1000/16000)}ms)`, type:'string', error:jitter>20 },
      { key:'Fraction Lost', value:`${lost}/256`, type:'number', error:lost>10 },
    ],
  }];
}

function generateHttp2Decoded(msgName: string, status: SessionStatus): DecodedField[] {
  const streamId = Math.floor(Math.random()*255)*2+1;
  return [{
    key:'HTTP2-Frame', value:'HEADERS', type:'section', children:[
      { key:'Frame Type', value:'0x01 (HEADERS)', type:'hex' },
      { key:'Stream ID', value:String(streamId), type:'number' },
      { key:'HPACK Headers', value:'', type:'section', children:[
        { key:':method', value:status==='err'?'GET':'POST', type:'string' },
        { key:':path', value:'/nsmf-pdusession/v1/sm-contexts', type:'string' },
        { key:':authority', value:'smf-01.core.rakuten.local', type:'string' },
        { key:'content-type', value:'application/json', type:'string' },
        ...(status==='err'
          ? [{ key:':status', value:'400 Bad Request', type:'enum', error:true }, { key:'cause', value:'MANDATORY_IE_MISSING', type:'enum', error:true }]
          : [{ key:':status', value:'201 Created', type:'enum' }]),
      ]},
    ],
  }];
}

function generateDecoded(msgName: string, protocol: Protocol, status: SessionStatus, cause?: string): DecodedField[] {
  switch (protocol) {
    case 'NAS':   return generateNasDecoded(msgName, status, cause);
    case 'NGAP':  return generateNgapDecoded(msgName, status);
    case 'PFCP':  return generatePfcpDecoded(msgName, status);
    case 'SIP':   return generateSipDecoded(msgName, status);
    case 'RTP':   return generateRtpDecoded(msgName, status);
    case 'RTCP':  return generateRtcpDecoded(msgName, status);
    case 'HTTP2': return generateHttp2Decoded(msgName, status);
    default: return [{ key:protocol, value:msgName, type:'section', children:[{ key:'Status', value:status==='err'?'failure':'success', type:'enum', error:status==='err' }]}];
  }
}

// ── DPI generator ──────────────────────────────────────────────────────────────

function generateDpi(procedureName: ProcedureName, slice: SliceName, status: SessionStatus): DpiData {
  const isVoice = procedureName.startsWith('VoNR');
  const isData  = procedureName.startsWith('PDU');
  const errFactor = status==='err' ? 2 : status==='warn' ? 1.3 : 1;
  const appMap: Record<string,{appId:string;appCategory:string}> = {
    'PDU Session Establishment':{ appId:'internet.general', appCategory:'Web/Data' },
    'PDU Session Modification': { appId:'internet.general', appCategory:'Web/Data' },
    'PDU Session Release':      { appId:'internet.general', appCategory:'Web/Data' },
    'Handover (Xn)':            { appId:'signaling.mobility', appCategory:'Mobility' },
    'VoNR Session Setup':       { appId:'voice.vonr', appCategory:'VoNR/IMS' },
    'VoNR Session Release':     { appId:'voice.vonr', appCategory:'VoNR/IMS' },
  };
  const app = appMap[procedureName] ?? { appId:'signaling.5g', appCategory:'Signaling' };
  const flows: QosFlow[] = isVoice
    ? [{ qfi:1, fiveQI:1, type:'GBR', gbrDl:128, gbrUl:128, pdb:100 }, { qfi:5, fiveQI:5, type:'Non-GBR', pdb:300 }]
    : isData
    ? [{ qfi:6, fiveQI:6, type:'Non-GBR', pdb:300 }, ...(slice==='uRLLC' ? [{ qfi:2, fiveQI:2, type:'GBR' as const, gbrDl:50000, gbrUl:10000, pdb:10 }] : [])]
    : [{ qfi:5, fiveQI:5, type:'Non-GBR', pdb:300 }];
  const bytesBase = isVoice ? 28000 : isData ? 450000 : 12000;
  const anomalies: string[] = [];
  if (status==='err')  anomalies.push('Session establishment failure');
  if (status==='warn') anomalies.push('QoS negotiation degraded');
  if (slice==='uRLLC' && errFactor>1) anomalies.push('Latency SLA breach (>10ms)');
  return {
    appId: app.appId, appCategory: app.appCategory, dpi_flows: flows,
    bytesUl: Math.round(jitter(bytesBase*0.3)*errFactor), bytesDl: Math.round(jitter(bytesBase*0.7)*errFactor),
    packetsUl: Math.round(jitter(bytesBase*0.3/1400)), packetsDl: Math.round(jitter(bytesBase*0.7/1400)),
    jitterMs:  isVoice ? jitter(2) : undefined,
    latencyMs: slice==='uRLLC' ? jitter(8) : isVoice ? jitter(35) : undefined,
    mosScore:  isVoice ? parseFloat((status==='err' ? 1.2+Math.random() : status==='warn' ? 2.8+Math.random()*0.7 : 4.1+Math.random()*0.4).toFixed(2)) : undefined,
    anomalies,
  };
}

// ── Main session generator ─────────────────────────────────────────────────────

function generateSession(): Record<string, unknown> {
  const procedureName = weightedProcedure();
  const def = PROCS[procedureName];

  const rng = Math.random();
  const sessionStatus: SessionStatus =
    procedureName === 'Authentication Failure' ? 'err' :
    rng < 0.08 ? 'err' : rng < 0.13 ? 'warn' : 'ok';

  const gnbEntry = pick(GNB_POOL);
  const amfEntry = pick(AMF_POOL);
  const smfEntry = pick(SMF_POOL);
  const upfEntry = pick(UPF_POOL);
  const imsi     = pick(IMSI_POOL);
  const imsiIdx  = IMSI_POOL.indexOf(imsi);

  const availSlices = def.slices;
  const slice: SliceName = pick(availSlices);

  const baseDuration = slice==='uRLLC' && procedureName==='Handover (Xn)'
    ? Math.floor(Math.random()*10)+28
    : jitter(def.baseDurationMs);

  const cause5gmm = sessionStatus==='err' ? pick(Object.keys(CAUSE_5GMM)) : undefined;

  const nfColumns = def.nfFactory(
    gnbEntry.id, amfEntry.id, amfEntry.ip, smfEntry.id, smfEntry.ip, upfEntry.id, upfEntry.ip
  );

  const startTime = Date.now() - jitter(50);
  let cumMs = 0;
  const msgDelays = [0, ...def.messages.slice(1).map(() => 5+Math.floor(Math.random()*35))];
  const errorPoint = def.messages.findIndex(m => m.isErrorPoint);

  const messages: LadderMessage[] = def.messages.map((tmpl, idx) => {
    cumMs += msgDelays[idx];
    let msgStatus: SessionStatus = 'ok';
    if (sessionStatus==='err') {
      if (procedureName==='Authentication Failure') { msgStatus = idx>=2 ? 'err' : 'ok'; }
      else if (idx>=errorPoint && errorPoint>=0) { msgStatus = idx===errorPoint ? 'err' : 'ok'; }
    } else if (sessionStatus==='warn' && idx>=errorPoint && errorPoint>=0) {
      msgStatus = idx===errorPoint ? 'warn' : 'ok';
    }
    const byteLen = jitter(tmpl.baseByteLen);
    return {
      id: uid(), seq: tmpl.seq,
      timestamp: new Date(startTime+cumMs).toISOString(),
      from: tmpl.from, fromRole: tmpl.fromRole,
      to: tmpl.to, toRole: tmpl.toRole,
      iface: tmpl.iface, name: tmpl.name, protocol: tmpl.protocol,
      status: msgStatus, byteLen,
      rawHex: generateRawHex(byteLen, tmpl.protocol, tmpl.name, imsi),
      decoded: generateDecoded(tmpl.name, tmpl.protocol, msgStatus, cause5gmm),
    };
  });

  const now = new Date();
  return {
    id:            uid(),
    created_at:    now.toISOString(),
    timestamp:     `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`,
    imsi,
    msisdn: `+81-90-${String(3000+imsiIdx).slice(-4)}-${String(5000+(imsiIdx*7)%9999).padStart(4,'0')}`,
    procedure: procedureName,
    primary_iface: def.primaryIface,
    slice,
    duration_ms: baseDuration,
    status: sessionStatus,
    gnb: gnbEntry.id, amf: amfEntry.id, smf: smfEntry.id, upf: upfEntry.id,
    nfs: nfColumns,
    messages,
    kpis: {
      setupTimeMs:    jitter(baseDuration*0.4),
      throughputKbps: slice!=='mMTC' ? jitter(15000) : undefined,
      signalStrength: -(60+Math.floor(Math.random()*25)),
      packetLoss:     sessionStatus==='ok' ? 0 : parseFloat((Math.random()*4).toFixed(2)),
      handoverLat:    procedureName==='Handover (Xn)' ? baseDuration : undefined,
      cause5gmm:      cause5gmm ? CAUSE_5GMM[cause5gmm] : undefined,
    },
    dpi: generateDpi(procedureName, slice, sessionStatus),
  };
}

// ── Edge Function entry point ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  const seedSecret  = Deno.env.get('SEED_SECRET') ?? '';
  const authHeader  = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== seedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  const COUNT = 45;
  const sessions = Array.from({ length: COUNT }, generateSession);

  const { error } = await supabase.from('sessions').insert(sessions);
  if (error) {
    console.error('Insert error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  console.log(`Inserted ${COUNT} sessions`);
  return new Response(JSON.stringify({ inserted: COUNT }), { headers: { 'Content-Type': 'application/json' } });
});
