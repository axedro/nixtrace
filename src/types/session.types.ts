export type ProcedureName =
  | 'Registration'
  | 'PDU Session Establishment'
  | 'PDU Session Modification'
  | 'PDU Session Release'
  | 'Deregistration'
  | 'Authentication Failure'
  | 'Handover (Xn)'
  | 'Service Request'
  | 'UE Config Update';

export type SessionStatus = 'ok' | 'err' | 'warn';
export type SliceName = 'eMBB' | 'uRLLC' | 'mMTC';
export type InterfaceName = 'Uu' | 'N1' | 'N2' | 'N11' | 'N4' | 'Xn' | 'NG';
export type NfType = 'UE' | 'gNB' | 'AMF' | 'SMF' | 'UPF' | 'PCF' | 'AUSF' | 'UDM';
export type Protocol = 'NAS' | 'NGAP' | 'PFCP' | 'HTTP2' | 'XnAP';

export interface NfNode {
  id:       NfType;
  label:    string;
  hostname: string;
  ip:       string;
  role?:    'source' | 'target'; // discriminator for Handover dual-gNB
}

export interface DecodedField {
  key:       string;
  value:     string | number | boolean;
  type:      'string' | 'number' | 'bool' | 'hex' | 'enum' | 'section';
  children?: DecodedField[];
  error?:    boolean;
}

export interface LadderMessage {
  id:        string;
  seq:       number;
  timestamp: string;
  from:      NfType;
  fromRole?: 'source' | 'target';
  to:        NfType;
  toRole?:   'source' | 'target';
  iface:     InterfaceName;
  name:      string;
  protocol:  Protocol;
  status:    SessionStatus;
  byteLen:   number;
  rawHex:    string;
  decoded:   DecodedField[];
}

export interface SessionKpiData {
  setupTimeMs:      number;
  throughputKbps?:  number;
  signalStrength?:  number;
  packetLoss?:      number;
  handoverLat?:     number;
  cause5gmm?:       string;
}

export interface Session {
  id:            string;
  created_at:    string;
  timestamp:     string;
  imsi:          string;
  msisdn?:       string;
  procedure:     ProcedureName;
  primary_iface: InterfaceName;
  slice:         SliceName;
  duration_ms:   number;
  status:        SessionStatus;
  gnb:           string;
  amf:           string;
  smf?:          string;
  upf?:          string;
  nfs:           NfNode[];
  messages:      LadderMessage[];
  kpis:          SessionKpiData;
}

export interface FilterState {
  status:    SessionStatus | 'all';
  slice:     SliceName | 'all';
  procedure: ProcedureName | 'all';
  iface:     InterfaceName | 'all';
  imsi:      string;
}

export interface NIxTraceStore {
  sessions:        Session[];
  selectedSession: Session | null;
  selectedMessage: LadderMessage | null;
  filter:          FilterState;
  wsConnected:     boolean;
  liveMode:        boolean;
  addSession:      (s: Session) => void;
  selectSession:   (s: Session | null) => void;
  selectMessage:   (m: LadderMessage | null) => void;
  setFilter:       (f: Partial<FilterState>) => void;
  setConnected:    (v: boolean) => void;
  setLiveMode:     (v: boolean) => void;
}

export interface DemoScenario {
  id:              'A' | 'B' | 'C';
  label:           string;
  filter:          Partial<FilterState>;
  autoSelectFirst: boolean;
}
