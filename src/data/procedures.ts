import type { NfType, InterfaceName, Protocol, NfNode, ProcedureName } from '../types/session.types';

export interface MessageTemplate {
  seq:         number;
  from:        NfType;
  fromRole?:   'source' | 'target';
  to:          NfType;
  toRole?:     'source' | 'target';
  iface:       InterfaceName;
  name:        string;
  protocol:    Protocol;
  baseByteLen: number;
  isErrorPoint:boolean;
}

export interface ProcedureDef {
  name:        ProcedureName;
  nfColumns:   NfNode[];
  messages:    MessageTemplate[];
  slices:      string[];
  primaryIface: InterfaceName;
  baseDurationMs: number;
}

const NF_DEFS = {
  UE: (gnb: string): NfNode => ({
    id: 'UE', label: 'UE', hostname: `ue-${gnb.toLowerCase()}`, ip: '10.0.0.1',
  }),
  gNB: (label: string, ip: string, role?: 'source'|'target'): NfNode => ({
    id: 'gNB', label, hostname: `${label.toLowerCase()}.rakuten.local`, ip, role,
  }),
  AMF: (label: string, ip: string): NfNode => ({
    id: 'AMF', label, hostname: `${label.toLowerCase()}.core.rakuten.local`, ip,
  }),
  SMF: (label: string, ip: string): NfNode => ({
    id: 'SMF', label, hostname: `${label.toLowerCase()}.core.rakuten.local`, ip,
  }),
  UPF: (label: string, ip: string): NfNode => ({
    id: 'UPF', label, hostname: `${label.toLowerCase()}.core.rakuten.local`, ip,
  }),
  AUSF: (): NfNode => ({
    id: 'AUSF', label: 'AUSF', hostname: 'ausf-01.core.rakuten.local', ip: '10.20.4.1',
  }),
  UDM: (): NfNode => ({
    id: 'UDM', label: 'UDM', hostname: 'udm-01.core.rakuten.local', ip: '10.20.5.1',
  }),
};

export const PROCEDURE_DEFS: Record<ProcedureName, Omit<ProcedureDef, 'nfColumns'> & { nfFactory: (gnb: string, amf: string, amfIp: string, smf?: string, smfIp?: string, upf?: string, upfIp?: string) => NfNode[] }> = {
  'Registration': {
    name: 'Registration',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.AUSF(), NF_DEFS.UDM(),
    ],
    messages: [
      { seq: 1,  from:'UE',   to:'gNB',  iface:'Uu',  name:'Registration Request',      protocol:'NAS',   baseByteLen:120, isErrorPoint:false },
      { seq: 2,  from:'gNB',  to:'AMF',  iface:'NG',  name:'Initial UE Message (NG)',    protocol:'NGAP',  baseByteLen:180, isErrorPoint:false },
      { seq: 3,  from:'AMF',  to:'AUSF', iface:'N2',  name:'Nausf_UEAuthentication',     protocol:'HTTP2', baseByteLen:95,  isErrorPoint:false },
      { seq: 4,  from:'AUSF', to:'UDM',  iface:'N2',  name:'Nudm_UEAuthentication_Get',  protocol:'HTTP2', baseByteLen:85,  isErrorPoint:false },
      { seq: 5,  from:'AMF',  to:'UE',   iface:'N1',  name:'Authentication Request',     protocol:'NAS',   baseByteLen:110, isErrorPoint:true  },
      { seq: 6,  from:'UE',   to:'AMF',  iface:'N1',  name:'Authentication Response',    protocol:'NAS',   baseByteLen:105, isErrorPoint:false },
      { seq: 7,  from:'AMF',  to:'AUSF', iface:'N2',  name:'Nausf_UEAuthentication Conf',protocol:'HTTP2', baseByteLen:88,  isErrorPoint:false },
      { seq: 8,  from:'AMF',  to:'UE',   iface:'N1',  name:'Security Mode Command',      protocol:'NAS',   baseByteLen:98,  isErrorPoint:false },
      { seq: 9,  from:'UE',   to:'AMF',  iface:'N1',  name:'Security Mode Complete',     protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
      { seq: 10, from:'AMF',  to:'UDM',  iface:'N2',  name:'Nudm_UECM_Registration',     protocol:'HTTP2', baseByteLen:120, isErrorPoint:false },
      { seq: 11, from:'AMF',  to:'UE',   iface:'N1',  name:'Registration Accept',        protocol:'NAS',   baseByteLen:145, isErrorPoint:false },
      { seq: 12, from:'UE',   to:'AMF',  iface:'N1',  name:'Registration Complete',      protocol:'NAS',   baseByteLen:65,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC', 'mMTC'],
    primaryIface: 'N1',
    baseDurationMs: 180,
  },

  'PDU Session Establishment': {
    name: 'PDU Session Establishment',
    nfFactory: (gnb, amf, amfIp, smf, smfIp, upf, upfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.SMF(smf!, smfIp!), NF_DEFS.UPF(upf!, upfIp!),
    ],
    messages: [
      { seq: 1,  from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Est. Request',     protocol:'NAS',   baseByteLen:155, isErrorPoint:false },
      { seq: 2,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_CreateSMContext',protocol:'HTTP2', baseByteLen:200, isErrorPoint:false },
      { seq: 3,  from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Est. Request',    protocol:'PFCP',  baseByteLen:320, isErrorPoint:false },
      { seq: 4,  from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Est. Response',   protocol:'PFCP',  baseByteLen:280, isErrorPoint:false },
      { seq: 5,  from:'SMF', to:'AMF', iface:'N11', name:'PDU Session Created (N11)',     protocol:'HTTP2', baseByteLen:180, isErrorPoint:false },
      { seq: 6,  from:'AMF', to:'gNB', iface:'NG',  name:'PDU Session Resource Setup Req',protocol:'NGAP',  baseByteLen:340, isErrorPoint:false },
      { seq: 7,  from:'gNB', to:'AMF', iface:'NG',  name:'PDU Session Resource Setup Rsp',protocol:'NGAP',  baseByteLen:295, isErrorPoint:true  },
      { seq: 8,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_UpdateSMContext',protocol:'HTTP2', baseByteLen:160, isErrorPoint:false },
      { seq: 9,  from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Est. Accept',      protocol:'NAS',   baseByteLen:175, isErrorPoint:false },
      { seq: 10, from:'UE',  to:'UPF', iface:'Uu',  name:'UE Data Path Established',     protocol:'NAS',   baseByteLen:60,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC', 'mMTC'],
    primaryIface: 'N11',
    baseDurationMs: 220,
  },

  'PDU Session Modification': {
    name: 'PDU Session Modification',
    nfFactory: (gnb, amf, amfIp, smf, smfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.SMF(smf!, smfIp!),
    ],
    messages: [
      { seq: 1, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Mod. Request',      protocol:'NAS',   baseByteLen:130, isErrorPoint:false },
      { seq: 2, from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_UpdateSMContext',protocol:'HTTP2', baseByteLen:185, isErrorPoint:false },
      { seq: 3, from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Mod. Request',     protocol:'PFCP',  baseByteLen:260, isErrorPoint:false },
      { seq: 4, from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Mod. Response',    protocol:'PFCP',  baseByteLen:210, isErrorPoint:false },
      { seq: 5, from:'SMF', to:'AMF', iface:'N11', name:'PDU Mod. Decision (N11)',        protocol:'HTTP2', baseByteLen:145, isErrorPoint:true  },
      { seq: 6, from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Mod. Command',      protocol:'NAS',   baseByteLen:160, isErrorPoint:false },
      { seq: 7, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Mod. Complete',     protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC'],
    primaryIface: 'N11',
    baseDurationMs: 140,
  },

  'PDU Session Release': {
    name: 'PDU Session Release',
    nfFactory: (gnb, amf, amfIp, smf, smfIp, upf, upfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.SMF(smf!, smfIp!), NF_DEFS.UPF(upf!, upfIp!),
    ],
    messages: [
      { seq: 1, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Release Request',   protocol:'NAS',   baseByteLen:95,  isErrorPoint:false },
      { seq: 2, from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession_ReleaseSMContext',protocol:'HTTP2', baseByteLen:155, isErrorPoint:false },
      { seq: 3, from:'SMF', to:'UPF', iface:'N4',  name:'PFCP Session Deletion Request', protocol:'PFCP',  baseByteLen:185, isErrorPoint:false },
      { seq: 4, from:'UPF', to:'SMF', iface:'N4',  name:'PFCP Session Deletion Response',protocol:'PFCP',  baseByteLen:140, isErrorPoint:true  },
      { seq: 5, from:'AMF', to:'UE',  iface:'N1',  name:'PDU Session Release Command',   protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
      { seq: 6, from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Release Complete',  protocol:'NAS',   baseByteLen:80,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC', 'mMTC'],
    primaryIface: 'N11',
    baseDurationMs: 120,
  },

  'Deregistration': {
    name: 'Deregistration',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
    ],
    messages: [
      { seq: 1, from:'UE',  to:'AMF', iface:'N1', name:'Deregistration Request (UE init)',  protocol:'NAS',  baseByteLen:95,  isErrorPoint:false },
      { seq: 2, from:'AMF', to:'UE',  iface:'N1', name:'Deregistration Accept',             protocol:'NAS',  baseByteLen:65,  isErrorPoint:false },
      { seq: 3, from:'AMF', to:'gNB', iface:'N2', name:'UE Context Release Command',        protocol:'NGAP', baseByteLen:120, isErrorPoint:false },
      { seq: 4, from:'gNB', to:'AMF', iface:'N2', name:'UE Context Release Complete',       protocol:'NGAP', baseByteLen:95,  isErrorPoint:false },
      { seq: 5, from:'UE',  to:'gNB', iface:'Uu', name:'RRC Release',                      protocol:'NAS',  baseByteLen:55,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC', 'mMTC'],
    primaryIface: 'N1',
    baseDurationMs: 90,
  },

  'Authentication Failure': {
    name: 'Authentication Failure',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp), NF_DEFS.AUSF(),
    ],
    messages: [
      { seq: 1, from:'UE',   to:'AMF',  iface:'N1', name:'Registration Request',       protocol:'NAS',   baseByteLen:120, isErrorPoint:false },
      { seq: 2, from:'gNB',  to:'AMF',  iface:'NG', name:'Initial UE Message (NG)',     protocol:'NGAP',  baseByteLen:180, isErrorPoint:false },
      { seq: 3, from:'AMF',  to:'AUSF', iface:'N2', name:'Nausf_UEAuthentication',      protocol:'HTTP2', baseByteLen:95,  isErrorPoint:false },
      { seq: 4, from:'AMF',  to:'UE',   iface:'N1', name:'Authentication Request',      protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
      { seq: 5, from:'UE',   to:'AMF',  iface:'N1', name:'Authentication Failure (MAC)',protocol:'NAS',   baseByteLen:88,  isErrorPoint:true  },
    ],
    slices: ['eMBB', 'uRLLC', 'mMTC'],
    primaryIface: 'N1',
    baseDurationMs: 55,
  },

  'Handover (Xn)': {
    name: 'Handover (Xn)',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb),
      NF_DEFS.gNB(`${gnb}-SRC`, '10.10.1.1', 'source'),
      NF_DEFS.gNB(`${gnb}-TGT`, '10.10.2.1', 'target'),
      NF_DEFS.AMF(amf, amfIp),
    ],
    messages: [
      { seq: 1, from:'gNB', fromRole:'source', to:'gNB', toRole:'target', iface:'Xn',  name:'Handover Request',           protocol:'XnAP',  baseByteLen:380, isErrorPoint:false },
      { seq: 2, from:'gNB', fromRole:'target', to:'gNB', toRole:'source', iface:'Xn',  name:'Handover Request Ack',        protocol:'XnAP',  baseByteLen:310, isErrorPoint:false },
      { seq: 3, from:'UE',  to:'gNB',          toRole:'target',           iface:'Uu',  name:'RRC Reconfiguration Complete',protocol:'NAS',   baseByteLen:85,  isErrorPoint:false },
      { seq: 4, from:'gNB', fromRole:'target',  to:'AMF',                 iface:'NG',  name:'Path Switch Request',         protocol:'NGAP',  baseByteLen:295, isErrorPoint:false },
      { seq: 5, from:'AMF', to:'gNB',           toRole:'target',          iface:'NG',  name:'Path Switch Request Ack',     protocol:'NGAP',  baseByteLen:265, isErrorPoint:true  },
      { seq: 6, from:'gNB', fromRole:'target',  to:'gNB', toRole:'source',iface:'Xn',  name:'UE Context Release',          protocol:'XnAP',  baseByteLen:120, isErrorPoint:false },
    ],
    slices: ['uRLLC', 'eMBB'],
    primaryIface: 'Xn',
    baseDurationMs: 38,
  },

  'Service Request': {
    name: 'Service Request',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
    ],
    messages: [
      { seq: 1, from:'UE',  to:'AMF', iface:'N1', name:'Service Request',              protocol:'NAS',  baseByteLen:98,  isErrorPoint:false },
      { seq: 2, from:'gNB', to:'AMF', iface:'NG', name:'Initial UE Message (Service)', protocol:'NGAP', baseByteLen:155, isErrorPoint:false },
      { seq: 3, from:'AMF', to:'gNB', iface:'NG', name:'Initial Context Setup Request',protocol:'NGAP', baseByteLen:280, isErrorPoint:false },
      { seq: 4, from:'AMF', to:'UE',  iface:'N1', name:'Service Reject (Congestion)',  protocol:'NAS',  baseByteLen:88,  isErrorPoint:true  },
      { seq: 5, from:'gNB', to:'AMF', iface:'NG', name:'Initial Context Setup Rsp',   protocol:'NGAP', baseByteLen:235, isErrorPoint:false },
      { seq: 6, from:'AMF', to:'UE',  iface:'N1', name:'Service Accept',               protocol:'NAS',  baseByteLen:110, isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC'],
    primaryIface: 'N1',
    baseDurationMs: 100,
  },

  'UE Config Update': {
    name: 'UE Config Update',
    nfFactory: (gnb, amf, amfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
    ],
    messages: [
      { seq: 1, from:'AMF', to:'UE',  iface:'N1', name:'Configuration Update Command', protocol:'NAS', baseByteLen:145, isErrorPoint:false },
      { seq: 2, from:'UE',  to:'AMF', iface:'N1', name:'Config Update Complete',       protocol:'NAS', baseByteLen:88,  isErrorPoint:false },
      { seq: 3, from:'AMF', to:'UE',  iface:'N1', name:'Config Update Command (NACK)', protocol:'NAS', baseByteLen:95,  isErrorPoint:true  },
      { seq: 4, from:'UE',  to:'AMF', iface:'N1', name:'Config Update NACK',           protocol:'NAS', baseByteLen:75,  isErrorPoint:false },
    ],
    slices: ['eMBB', 'mMTC'],
    primaryIface: 'N1',
    baseDurationMs: 75,
  },

  'VoNR Session Setup': {
    name: 'VoNR Session Setup',
    nfFactory: (gnb, amf, amfIp, smf, smfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.SMF(smf!, smfIp!),
    ],
    messages: [
      { seq: 1,  from:'UE',  to:'AMF', iface:'N1',  name:'PDU Session Est. (IMS APN)',    protocol:'NAS',   baseByteLen:165, isErrorPoint:false },
      { seq: 2,  from:'AMF', to:'SMF', iface:'N11', name:'Nsmf_PDUSession Create (IMS)',  protocol:'HTTP2', baseByteLen:210, isErrorPoint:false },
      { seq: 3,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP REGISTER',                 protocol:'SIP',   baseByteLen:540, isErrorPoint:false },
      { seq: 4,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 100 Trying',               protocol:'SIP',   baseByteLen:280, isErrorPoint:false },
      { seq: 5,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 200 OK (REGISTER)',        protocol:'SIP',   baseByteLen:420, isErrorPoint:false },
      { seq: 6,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP INVITE',                   protocol:'SIP',   baseByteLen:680, isErrorPoint:true  },
      { seq: 7,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 183 Session Progress',     protocol:'SIP',   baseByteLen:380, isErrorPoint:false },
      { seq: 8,  from:'AMF', to:'UE',  iface:'N1',  name:'SIP 200 OK (INVITE)',          protocol:'SIP',   baseByteLen:510, isErrorPoint:false },
      { seq: 9,  from:'UE',  to:'AMF', iface:'N1',  name:'SIP ACK',                      protocol:'SIP',   baseByteLen:220, isErrorPoint:false },
      { seq: 10, from:'UE',  to:'SMF', iface:'N4',  name:'RTP Stream Established',       protocol:'RTP',   baseByteLen:172, isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC'],
    primaryIface: 'N1',
    baseDurationMs: 320,
  },

  'VoNR Session Release': {
    name: 'VoNR Session Release',
    nfFactory: (gnb, amf, amfIp, smf, smfIp) => [
      NF_DEFS.UE(gnb), NF_DEFS.gNB(gnb, '10.10.1.1'), NF_DEFS.AMF(amf, amfIp),
      NF_DEFS.SMF(smf!, smfIp!),
    ],
    messages: [
      { seq: 1, from:'UE',  to:'AMF', iface:'N1', name:'SIP BYE',                    protocol:'SIP',   baseByteLen:280, isErrorPoint:false },
      { seq: 2, from:'AMF', to:'UE',  iface:'N1', name:'SIP 200 OK (BYE)',           protocol:'SIP',   baseByteLen:240, isErrorPoint:false },
      { seq: 3, from:'UE',  to:'SMF', iface:'N4', name:'RTCP BYE',                   protocol:'RTCP',  baseByteLen:64,  isErrorPoint:false },
      { seq: 4, from:'AMF', to:'SMF', iface:'N11',name:'Nsmf_PDUSession Release IMS',protocol:'HTTP2', baseByteLen:165, isErrorPoint:true  },
      { seq: 5, from:'AMF', to:'UE',  iface:'N1', name:'PDU Session Release Command',protocol:'NAS',   baseByteLen:110, isErrorPoint:false },
    ],
    slices: ['eMBB', 'uRLLC'],
    primaryIface: 'N1',
    baseDurationMs: 95,
  },
};
