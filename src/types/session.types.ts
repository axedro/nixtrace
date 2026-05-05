export type ProcedureName =
  | 'Registration'
  | 'PDU Session Establishment'
  | 'PDU Session Modification'
  | 'PDU Session Release'
  | 'Deregistration'
  | 'Authentication Failure'
  | 'Handover (Xn)'
  | 'Service Request'
  | 'UE Config Update'
  | 'VoNR Session Setup'
  | 'VoNR Session Release';

export type SessionStatus = 'ok' | 'err' | 'warn';
export type SliceName = 'eMBB' | 'uRLLC' | 'mMTC';
export type InterfaceName = 'Uu' | 'N1' | 'N2' | 'N11' | 'N4' | 'Xn' | 'NG';
export type NfType = 'UE' | 'gNB' | 'AMF' | 'SMF' | 'UPF' | 'PCF' | 'AUSF' | 'UDM';
export type Protocol = 'NAS' | 'NGAP' | 'PFCP' | 'HTTP2' | 'XnAP' | 'SIP' | 'RTP' | 'RTCP';

export type CaptureMode = 'online' | 'historical' | 'combined' | 'scheduled';

export interface TriggerRule {
  id:        string;
  enabled:   boolean;
  label:     string;
  condition: {
    field:    'status' | 'procedure' | 'slice' | 'imsi' | 'duration_ms' | 'packet_loss';
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
    value:    string;
  };
  action: 'capture' | 'alert' | 'both';
}

export interface QosFlow {
  qfi:    number;
  fiveQI: number;
  type:   'GBR' | 'Non-GBR';
  gbrDl?: number;
  gbrUl?: number;
  pdb:    number;
}

export interface DpiData {
  appId:        string;
  appCategory:  string;
  dpi_flows:    QosFlow[];
  bytesUl:      number;
  bytesDl:      number;
  packetsUl:    number;
  packetsDl:    number;
  jitterMs?:    number;
  latencyMs?:   number;
  mosScore?:    number;
  anomalies:    string[];
}

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
  dpi?:          DpiData;
  correlatedIds?: string[];
}

export interface FilterState {
  status:    SessionStatus | 'all';
  slice:     SliceName | 'all';
  procedure: ProcedureName | 'all';
  iface:     InterfaceName | 'all';
  imsi:      string;
}

export interface HistoricalRange {
  from: string;
  to:   string;
}

export interface NIxTraceStore {
  sessions:        Session[];
  selectedSession: Session | null;
  selectedMessage: LadderMessage | null;
  filter:          FilterState;
  wsConnected:     boolean;
  liveMode:        boolean;
  captureMode:     CaptureMode;
  historicalRange: HistoricalRange | null;
  triggerRules:    TriggerRule[];
  triggerActive:   boolean;
  bufferSize:      number;
  showTriggerModal:boolean;
  addSession:      (s: Session) => void;
  selectSession:   (s: Session | null) => void;
  selectMessage:   (m: LadderMessage | null) => void;
  setFilter:       (f: Partial<FilterState>) => void;
  setConnected:    (v: boolean) => void;
  setLiveMode:     (v: boolean) => void;
  setCaptureMode:  (m: CaptureMode) => void;
  setHistoricalRange: (r: HistoricalRange | null) => void;
  setTriggerRules: (rules: TriggerRule[]) => void;
  setTriggerActive:(v: boolean) => void;
  setBufferSize:   (n: number) => void;
  setShowTriggerModal: (v: boolean) => void;
}

export interface DemoScenario {
  id:              'A' | 'B' | 'C';
  label:           string;
  filter:          Partial<FilterState>;
  autoSelectFirst: boolean;
}
