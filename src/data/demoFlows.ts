import type { Session, LadderMessage, NfNode, DecodedField } from '../types/session.types';

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
  { id: 'UE',   label: 'UE',   hostname: 'ue-rak-001',              ip: '10.0.0.1'   },
  { id: 'gNB',  label: 'gNB-O-CU', hostname: 'gnb-rak-01.rakuten.local', ip: '10.10.1.1'  },
  { id: 'AMF',  label: 'AMF-01',   hostname: 'amf-01.core.rakuten.local', ip: '10.20.1.1'  },
  { id: 'AUSF', label: 'AUSF-01',  hostname: 'ausf-01.core.rakuten.local', ip: '10.20.4.1'  },
  { id: 'UDM',  label: 'UDM-01',   hostname: 'udm-01.core.rakuten.local',  ip: '10.20.5.1'  },
  { id: 'PCF',  label: 'PCF-01',   hostname: 'pcf-01.core.rakuten.local',  ip: '10.20.6.1'  },
  { id: 'SMF',  label: 'SMF-01',   hostname: 'smf-01.core.rakuten.local',  ip: '10.20.2.1'  },
  { id: 'UPF',  label: 'UPF-01',   hostname: 'upf-01.core.rakuten.local',  ip: '10.20.3.1'  },
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

// ─── Flow A messages (34 messages — PDF authoritative) ──────────────────────

const BASE_TS = '2025-01-15T09:00:00.000Z';

function ts(offsetMs: number): string {
  return new Date(new Date(BASE_TS).getTime() + offsetMs).toISOString();
}

const MSGS_5GSA: Omit<LadderMessage, 'id'>[] = [
  // ── 1. RRC Setup Request ────────────────────────────────────────────────
  {
    seq: 1, timestamp: ts(0),
    from: 'UE', to: 'gNB', iface: 'Uu', protocol: 'RRC', status: 'ok', byteLen: 18,
    name: 'RRC Setup Request',
    rawHex: '00 01 28 00 01 e0 6c 04 f7',
    decoded: [
      sec('RRC Setup Request', [
        enm('rrcSetupRequest.ue-Identity.randomValue', 'randomValue'),
        hex('randomValue', '0x01E06C04F7'),
        enm('establishmentCause', 'mo-Signalling'),
      ]),
    ],
  },
  // ── 2. RRC Setup ────────────────────────────────────────────────────────
  {
    seq: 2, timestamp: ts(2),
    from: 'gNB', to: 'UE', iface: 'Uu', protocol: 'RRC', status: 'ok', byteLen: 122,
    name: 'RRC Setup',
    rawHex: '68 20 00 08 40 01 9e 40 00 80',
    decoded: [
      sec('RRC Setup', [
        sec('radioBearerConfig', [
          sec('srb-ToAddModList[0]', [
            num('srb-Identity', 1),
            sec('pdcp-Config', [
              enm('headerCompression', 'notUsed'),
            ]),
          ]),
        ]),
        sec('masterCellGroup', [
          num('cellGroupId', 0),
          sec('rlc-BearerToAddModList[0]', [
            num('logicalChannelIdentity', 1),
            enm('servedRadioBearerInfo.srb-Identity', '1'),
          ]),
        ]),
      ]),
    ],
  },
  // ── 3. RRC Setup Complete / Registration Request ─────────────────────────
  {
    seq: 3, timestamp: ts(5),
    from: 'UE', to: 'gNB', iface: 'Uu', protocol: 'RRC', status: 'ok', byteLen: 156,
    name: 'RRC Setup Complete (Registration Request)',
    rawHex: '28 00 3e 7e 00 41 79 00 0d 01 00 f1 10 00 00 00 01 2e 04 f0 f0 f0 f0',
    decoded: [
      sec('RRC Setup Complete', [
        num('rrc-TransactionIdentifier', 0),
        sec('criticalExtensions.rrcSetupComplete', [
          num('selectedPLMN-Identity', 1),
          sec('dedicatedNAS-Message', [
            sec('NAS-5GS Registration Request', [
              hex('epd', '0x7E'),
              hex('spare', '0x00'),
              enm('security-header-type', 'Plain NAS'),
              hex('message-type', '0x41'),
              enm('5gs-registration-type', 'initial-registration'),
              enm('nas-key-set-identifier', 'no key available'),
              sec('5gs-mobile-identity (SUCI)', [
                enm('supi-format', 'IMSI'),
                str('mcc', '440'),
                str('mnc', '10'),
                str('routing-indicator', '0000'),
                enm('protection-scheme-id', 'null'),
                str('home-network-public-key-id', '0'),
                str('msin', '000000001'),
              ]),
              enm('5gmm-capability.IMS-VoPS-3GPP', 'supported'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 4. Initial UE Message (NGAP) ─────────────────────────────────────────
  {
    seq: 4, timestamp: ts(6),
    from: 'gNB', to: 'AMF', iface: 'N2', protocol: 'NGAP', status: 'ok', byteLen: 192,
    name: 'Initial UE Message',
    rawHex: '00 0f 40 78 00 00 04 00 55 00 01 00 00 26 00 9e',
    decoded: [
      sec('NGAP InitialUEMessage', [
        num('RAN-UE-NGAP-ID', 1001),
        sec('NAS-PDU (Registration Request)', [
          str('see', 'seq 3 NAS decode'),
        ]),
        sec('UserLocationInformation', [
          sec('userLocationInformationNR', [
            str('plmn-Identity.mcc', '440'),
            str('plmn-Identity.mnc', '10'),
            num('nrCellIdentity', 0x123456789),
            num('tac', 1),
          ]),
        ]),
        enm('RRCEstablishmentCause', 'mo-Signalling'),
      ]),
    ],
  },
  // ── 5. Identity Request (PDF-only — synthesized) ─────────────────────────
  {
    seq: 5, timestamp: ts(8),
    from: 'AMF', to: 'UE', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 14,
    name: 'Identity Request',
    rawHex: '7e 00 55 00 01 01',
    decoded: [
      sec('NAS-5GS Identity Request', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Plain NAS'),
        hex('message-type', '0x55'),
        enm('5gs-identity-type', 'SUCI'),
      ]),
    ],
  },
  // ── 6. Identity Response (PDF-only — synthesized) ────────────────────────
  {
    seq: 6, timestamp: ts(10),
    from: 'UE', to: 'AMF', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 28,
    name: 'Identity Response',
    rawHex: '7e 00 56 00 0d 01 00 f1 10 00 00 00 01 00 00 00 01',
    decoded: [
      sec('NAS-5GS Identity Response', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Plain NAS'),
        hex('message-type', '0x56'),
        sec('5gs-mobile-identity (SUCI)', [
          enm('supi-format', 'IMSI'),
          str('mcc', '440'),
          str('mnc', '10'),
          str('routing-indicator', '0000'),
          enm('protection-scheme-id', 'null'),
          str('msin', '000000001'),
        ]),
      ]),
    ],
  },
  // ── 7. Nausf_UEAuthentication_Authenticate Request ───────────────────────
  {
    seq: 7, timestamp: ts(12),
    from: 'AMF', to: 'AUSF', iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 87,
    name: 'Nausf_UEAuthentication Authenticate Request',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /nausf-auth/v1/ue-authentications', [
        str(':method', 'POST'),
        str(':path', '/nausf-auth/v1/ue-authentications'),
        str('content-type', 'application/json'),
        sec('body', [
          str('supiOrSuci', 'suci-0-440-10-0000-0-0-000000001'),
          str('servingNetworkName', '5G:mnc010.mcc440.3gppnetwork.org'),
          str('resynchronizationInfo', ''),
        ]),
      ]),
    ],
  },
  // ── 8. Nudm_UEAuthentication_Get Request ─────────────────────────────────
  {
    seq: 8, timestamp: ts(14),
    from: 'AUSF', to: 'UDM', iface: 'N13', protocol: 'HTTP2', status: 'ok', byteLen: 82,
    name: 'Nudm_UEAuthentication Get Request',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /nudm-ueau/v1/{supiOrSuci}/security-information/generate-auth-data', [
        str(':method', 'POST'),
        str(':path', '/nudm-ueau/v1/suci-0-440-10-0000-0-0-000000001/security-information/generate-auth-data'),
        str('content-type', 'application/json'),
        sec('body', [
          str('supportedFeatures', ''),
          str('servingNetworkName', '5G:mnc010.mcc440.3gppnetwork.org'),
          enm('resynchronizationInfo', 'absent'),
        ]),
      ]),
    ],
  },
  // ── 9. Nudm_UEAuthentication_Get Response ────────────────────────────────
  {
    seq: 9, timestamp: ts(18),
    from: 'UDM', to: 'AUSF', iface: 'N13', protocol: 'HTTP2', status: 'ok', byteLen: 210,
    name: 'Nudm_UEAuthentication Get Response (200 OK)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 200 OK', [
        str(':status', '200'),
        str('content-type', 'application/json'),
        sec('body (UEAuthenticationCtx)', [
          enm('authType', '5G_AKA'),
          sec('5G-HE-AV', [
            hex('rand', '0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),
            hex('xres*', '0x9F8E7D6C5B4A3928'),
            hex('autn', '0x1234567890ABCDEF'),
            hex('kausf', '0xFEDCBA9876543210FEDCBA9876543210'),
          ]),
        ]),
      ]),
    ],
  },
  // ── 10. Nausf_UEAuthentication_Authenticate Response ─────────────────────
  {
    seq: 10, timestamp: ts(20),
    from: 'AUSF', to: 'AMF', iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 195,
    name: 'Nausf_UEAuthentication Authenticate Response (201 Created)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 201 Created', [
        str(':status', '201'),
        str('location', '/nausf-auth/v1/ue-authentications/suci-0-440-10-0000-0-0-000000001'),
        sec('body (UEAuthenticationCtx)', [
          enm('authType', '5G_AKA'),
          sec('_links.5g-aka.href', [
            str('href', '/nausf-auth/v1/ue-authentications/suci-0-440-10-0000-0-0-000000001/5g-aka-confirmation'),
          ]),
          sec('5G-AV', [
            hex('rand', '0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),
            hex('hxres*', '0x4F5E6D7C8B9A0B1C'),
            hex('autn', '0x1234567890ABCDEF'),
            hex('kseaf', '0xAABBCCDDEEFF00112233445566778899'),
          ]),
        ]),
      ]),
    ],
  },
  // ── 11. Authentication Request ───────────────────────────────────────────
  {
    seq: 11, timestamp: ts(22),
    from: 'AMF', to: 'UE', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 110,
    name: 'Authentication Request',
    rawHex: '7e 00 56 21 01 00 10 a1 b2 c3 d4 e5 f6 07 18 29 3a 4b 5c 6d 7e 8f 90',
    decoded: [
      sec('NAS-5GS Authentication Request', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Plain NAS'),
        hex('message-type', '0x56'),
        num('ngksi', 1),
        hex('ABBA', '0x0000'),
        sec('Authentication Parameter RAND', [
          hex('rand', '0xA1B2C3D4E5F60718293A4B5C6D7E8F90'),
        ]),
        sec('Authentication Parameter AUTN', [
          hex('autn', '0x1234567890ABCDEF'),
        ]),
      ]),
    ],
  },
  // ── 12. Authentication Response ──────────────────────────────────────────
  {
    seq: 12, timestamp: ts(26),
    from: 'UE', to: 'AMF', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 42,
    name: 'Authentication Response',
    rawHex: '7e 00 57 2d 10 9f 8e 7d 6c 5b 4a 39 28',
    decoded: [
      sec('NAS-5GS Authentication Response', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Plain NAS'),
        hex('message-type', '0x57'),
        sec('EAP-Response / Authentication Parameter RES*', [
          hex('res*', '0x9F8E7D6C5B4A3928'),
        ]),
      ]),
    ],
  },
  // ── 13. Nausf_UEAuthentication Confirmation ──────────────────────────────
  {
    seq: 13, timestamp: ts(28),
    from: 'AMF', to: 'AUSF', iface: 'N12', protocol: 'HTTP2', status: 'ok', byteLen: 75,
    name: 'Nausf_UEAuthentication Confirmation (PUT)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 PUT /nausf-auth/v1/ue-authentications/{authCtxId}/5g-aka-confirmation', [
        str(':method', 'PUT'),
        str(':path', '/nausf-auth/v1/ue-authentications/suci-0-440-10-0000-0-0-000000001/5g-aka-confirmation'),
        sec('body (ConfirmationData)', [
          hex('resStar', '0x9F8E7D6C5B4A3928'),
        ]),
      ]),
    ],
  },
  // ── 14. Security Mode Command ────────────────────────────────────────────
  {
    seq: 14, timestamp: ts(31),
    from: 'AMF', to: 'UE', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 65,
    name: 'Security Mode Command',
    rawHex: '7e 03 4e 49 c0 00 5d 01 02 e1 e0 00',
    decoded: [
      sec('NAS-5GS Security Mode Command', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Integrity protected'),
        hex('message-type', '0x5D'),
        sec('NAS security algorithms', [
          enm('ciphering', '128-5G-EA1'),
          enm('integrity', '128-5G-IA1'),
        ]),
        num('ngksi', 1),
        sec('UE security capabilities', [
          hex('5G-EA', '0xE0'),
          hex('5G-IA', '0xE0'),
        ]),
      ]),
    ],
  },
  // ── 15. Security Mode Complete ───────────────────────────────────────────
  {
    seq: 15, timestamp: ts(34),
    from: 'UE', to: 'AMF', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 78,
    name: 'Security Mode Complete',
    rawHex: '7e 04 5e 00 7b 00 0e 52 f2 ff 00 f1 10 00 00 00 01',
    decoded: [
      sec('NAS-5GS Security Mode Complete', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Integrity + ciphered'),
        hex('message-type', '0x5E'),
        sec('IMEISV (NAS message container)', [
          str('imeisv', '35902311324857800'),
        ]),
        sec('NAS message container (Registration Request)', [
          str('see', 'seq 3 full Registration Request'),
        ]),
      ]),
    ],
  },
  // ── 16. Nudm_SDM_Get (Subscription Data) ─────────────────────────────────
  {
    seq: 16, timestamp: ts(37),
    from: 'AMF', to: 'UDM', iface: 'N8', protocol: 'HTTP2', status: 'ok', byteLen: 95,
    name: 'Nudm_SDM_Get (AM subscription data)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 GET /nudm-sdm/v2/{supi}/am-data', [
        str(':method', 'GET'),
        str(':path', '/nudm-sdm/v2/imsi-440100000000001/am-data'),
        str('supported-features', '3fff'),
      ]),
    ],
  },
  // ── 17. Nudm_SDM_Get Response ────────────────────────────────────────────
  {
    seq: 17, timestamp: ts(40),
    from: 'UDM', to: 'AMF', iface: 'N8', protocol: 'HTTP2', status: 'ok', byteLen: 180,
    name: 'Nudm_SDM_Get Response (200 OK)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 200 OK', [
        str(':status', '200'),
        sec('body (AccessAndMobilitySubscriptionData)', [
          str('gpsis[0]', 'msisdn-819011111111'),
          sec('subscribedUeAmbr', [
            str('uplink', '200 Mbps'),
            str('downlink', '400 Mbps'),
          ]),
          sec('nssai.defaultSingleNssais[0]', [
            num('sst', 1),
            str('sd', '000001'),
          ]),
        ]),
      ]),
    ],
  },
  // ── 18. Npcf_AMPolicyControl_Create Request ───────────────────────────────
  {
    seq: 18, timestamp: ts(43),
    from: 'AMF', to: 'PCF', iface: 'N15', protocol: 'HTTP2', status: 'ok', byteLen: 145,
    name: 'Npcf_AMPolicyControl Create Request',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /npcf-am-policy-control/v1/policies', [
        str(':method', 'POST'),
        str(':path', '/npcf-am-policy-control/v1/policies'),
        sec('body (PolicyAssociationRequest)', [
          str('supi', 'imsi-440100000000001'),
          str('pei', 'imeisv-35902311324857800'),
          sec('userLoc', [
            str('nrLocation.tai.plmnId.mcc', '440'),
            str('nrLocation.tai.plmnId.mnc', '10'),
          ]),
        ]),
      ]),
    ],
  },
  // ── 19. Npcf_AMPolicyControl_Create Response ──────────────────────────────
  {
    seq: 19, timestamp: ts(47),
    from: 'PCF', to: 'AMF', iface: 'N15', protocol: 'HTTP2', status: 'ok', byteLen: 162,
    name: 'Npcf_AMPolicyControl Create Response (201 Created)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 201 Created', [
        str(':status', '201'),
        str('location', '/npcf-am-policy-control/v1/policies/imsi-440100000000001-001'),
        sec('body (PolicyAssociation)', [
          sec('pras', [
            str('service-area-restriction', 'full-service'),
          ]),
          boo('rfsp', false),
        ]),
      ]),
    ],
  },
  // ── 20. Registration Accept ──────────────────────────────────────────────
  {
    seq: 20, timestamp: ts(50),
    from: 'AMF', to: 'UE', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 145,
    name: 'Registration Accept',
    rawHex: '7e 02 42 01 77 00 09 01 02 00 f1 10 00 00 01 00',
    decoded: [
      sec('NAS-5GS Registration Accept', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Integrity + ciphered'),
        hex('message-type', '0x42'),
        sec('5GS registration result', [
          enm('SMS-over-NAS', 'not-allowed'),
          enm('5gs-registration-result', '3GPP access'),
        ]),
        sec('5G-GUTI', [
          str('mcc', '440'),
          str('mnc', '10'),
          hex('amf-region-id', '0x01'),
          hex('amf-set-id', '0x0001'),
          hex('amf-pointer', '0x00'),
          hex('5g-tmsi', '0x00000001'),
        ]),
        sec('Allowed NSSAI', [
          sec('[0]', [num('sst', 1), str('sd', '000001')]),
        ]),
        num('T3512', 54),
      ]),
    ],
  },
  // ── 21. Registration Complete ────────────────────────────────────────────
  {
    seq: 21, timestamp: ts(52),
    from: 'UE', to: 'AMF', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 12,
    name: 'Registration Complete',
    rawHex: '7e 02 43',
    decoded: [
      sec('NAS-5GS Registration Complete', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Integrity + ciphered'),
        hex('message-type', '0x43'),
      ]),
    ],
  },
  // ── 22. PDU Session Establishment Request ────────────────────────────────
  {
    seq: 22, timestamp: ts(55),
    from: 'UE', to: 'AMF', iface: 'N1', protocol: 'NAS', status: 'ok', byteLen: 165,
    name: 'PDU Session Establishment Request',
    rawHex: '7e 02 c1 00 01 2e 01 01 c1 ff ff 91 a1 28 01 00',
    decoded: [
      sec('NAS-5GS PDU Session Establishment Request', [
        hex('epd', '0x7E'),
        enm('security-header-type', 'Integrity + ciphered'),
        hex('message-type', '0xC1'),
        num('pdu-session-id', 1),
        num('pti', 1),
        enm('pdu-session-type', 'IPv4'),
        enm('ssc-mode', 'SSC mode 1'),
        sec('5GSM capability', [
          boo('MPTCP', false),
          boo('ATS-LL', false),
          boo('EPT-S1', true),
        ]),
        sec('Extended protocol configuration options', [
          str('ipcp-dns-primary', '8.8.8.8'),
          str('ipcp-dns-secondary', '8.8.4.4'),
        ]),
      ]),
    ],
  },
  // ── 23. Nsmf_PDUSession_CreateSMContext Request ──────────────────────────
  {
    seq: 23, timestamp: ts(57),
    from: 'AMF', to: 'SMF', iface: 'N11', protocol: 'HTTP2', status: 'ok', byteLen: 210,
    name: 'Nsmf_PDUSession CreateSMContext Request',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /nsmf-pdusession/v1/sm-contexts', [
        str(':method', 'POST'),
        str(':path', '/nsmf-pdusession/v1/sm-contexts'),
        sec('body (SmContextCreateData)', [
          str('supi', 'imsi-440100000000001'),
          str('pei', 'imeisv-35902311324857800'),
          str('gpsi', 'msisdn-819011111111'),
          num('pduSessionId', 1),
          str('dnn', 'internet.rakuten.co.jp'),
          sec('snssai', [num('sst', 1), str('sd', '000001')]),
          str('servingNfId', 'amf-01-uuid'),
          str('servingNetwork.mcc', '440'),
          str('servingNetwork.mnc', '10'),
          enm('anType', '3GPP_ACCESS'),
          str('ratType', 'NR'),
        ]),
      ]),
    ],
  },
  // ── 24. Nudm_SDM_Get (SM subscription data) ──────────────────────────────
  {
    seq: 24, timestamp: ts(59),
    from: 'SMF', to: 'UDM', iface: 'N10', protocol: 'HTTP2', status: 'ok', byteLen: 88,
    name: 'Nudm_SDM_Get (SM subscription data)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 GET /nudm-sdm/v2/{supi}/sm-data', [
        str(':method', 'GET'),
        str(':path', '/nudm-sdm/v2/imsi-440100000000001/sm-data?dnn=internet.rakuten.co.jp&single-nssai=%7B%22sst%22%3A1%7D'),
        str('supported-features', '07'),
      ]),
    ],
  },
  // ── 25. Npcf_SMPolicyControl_Create Request ───────────────────────────────
  {
    seq: 25, timestamp: ts(62),
    from: 'SMF', to: 'PCF', iface: 'N7', protocol: 'HTTP2', status: 'ok', byteLen: 175,
    name: 'Npcf_SMPolicyControl Create Request',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /npcf-smpolicycontrol/v1/sm-policies', [
        str(':method', 'POST'),
        str(':path', '/npcf-smpolicycontrol/v1/sm-policies'),
        sec('body (SmPolicyContextData)', [
          str('supi', 'imsi-440100000000001'),
          str('dnn', 'internet.rakuten.co.jp'),
          num('pduSessionId', 1),
          enm('pduSessionType', 'IPV4'),
          num('ipv4Address', 0),
          sec('snssai', [num('sst', 1), str('sd', '000001')]),
        ]),
      ]),
    ],
  },
  // ── 26. Npcf_SMPolicyControl_Create Response ──────────────────────────────
  {
    seq: 26, timestamp: ts(65),
    from: 'PCF', to: 'SMF', iface: 'N7', protocol: 'HTTP2', status: 'ok', byteLen: 188,
    name: 'Npcf_SMPolicyControl Create Response (201 Created)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 201 Created', [
        str(':status', '201'),
        str('location', '/npcf-smpolicycontrol/v1/sm-policies/imsi-440100000000001-1'),
        sec('body (SmPolicyDecision)', [
          sec('pccRules.rule-1', [
            num('precedence', 1),
            enm('flowStatus', 'ENABLED'),
            sec('flowInfos[0]', [
              str('flowDescription', 'permit out ip from any to assigned'),
              enm('flowDirection', 'BIDIRECTIONAL'),
            ]),
          ]),
          sec('qosDecs.qos-1', [
            num('5qi', 9),
            num('priorityLevel', 8),
          ]),
        ]),
      ]),
    ],
  },
  // ── 27. PFCP Session Establishment Request ────────────────────────────────
  {
    seq: 27, timestamp: ts(68),
    from: 'SMF', to: 'UPF', iface: 'N4', protocol: 'PFCP', status: 'ok', byteLen: 342,
    name: 'PFCP Session Establishment Request',
    rawHex: '21 32 01 56 00 00 00 01 00 00 00 01 00 01',
    decoded: [
      sec('PFCP Session Establishment Request', [
        sec('PFCP header', [
          enm('version', '1'),
          boo('FO', false),
          boo('MP', false),
          boo('S', true),
          hex('message-type', '0x32'),
          num('length', 342),
          num('seid', 0),
          num('sequence-number', 1),
        ]),
        sec('Node ID (IE)', [
          enm('node-id-type', 'FQDN'),
          str('fqdn', 'smf-01.core.rakuten.local'),
        ]),
        sec('F-SEID (IE)', [
          str('ipv4', '10.20.2.1'),
          num('seid', 1),
        ]),
        sec('Create PDR[1] (IE)', [
          num('pdr-id', 1),
          num('precedence', 100),
          sec('PDI', [
            enm('source-interface', 'Access'),
            sec('F-TEID', [
              boo('CHID', true),
              boo('CH', true),
              num('choose-id', 1),
            ]),
            sec('Network Instance', [str('value', 'internet.rakuten.co.jp')]),
            sec('UE IP address', [boo('SD', false), boo('V4', true)]),
          ]),
          num('far-id', 1),
          num('qer-id', 1),
          num('urr-id', 1),
        ]),
        sec('Create PDR[2] (IE)', [
          num('pdr-id', 2),
          num('precedence', 100),
          sec('PDI', [
            enm('source-interface', 'Core'),
            sec('Network Instance', [str('value', 'internet.rakuten.co.jp')]),
            sec('UE IP address', [boo('SD', false), boo('V4', true)]),
          ]),
          num('far-id', 2),
          num('qer-id', 1),
          num('urr-id', 1),
        ]),
        sec('Create FAR[1] (IE)', [
          num('far-id', 1),
          enm('apply-action', 'FORW'),
          sec('Forwarding Parameters', [
            enm('destination-interface', 'Core'),
            str('network-instance', 'internet.rakuten.co.jp'),
          ]),
        ]),
        sec('Create FAR[2] (IE)', [
          num('far-id', 2),
          enm('apply-action', 'FORW'),
          sec('Forwarding Parameters', [
            enm('destination-interface', 'Access'),
          ]),
        ]),
        sec('Create QER[1] (IE)', [
          num('qer-id', 1),
          enm('gate-status', 'OPEN/OPEN'),
          sec('MBR', [str('ul', '100 Mbps'), str('dl', '400 Mbps')]),
          sec('GBR', [str('ul', '0'), str('dl', '0')]),
          num('qfi', 1),
        ]),
      ]),
    ],
  },
  // ── 28. PFCP Session Establishment Response ───────────────────────────────
  {
    seq: 28, timestamp: ts(71),
    from: 'UPF', to: 'SMF', iface: 'N4', protocol: 'PFCP', status: 'ok', byteLen: 298,
    name: 'PFCP Session Establishment Response',
    rawHex: '21 33 01 2a 00 00 00 01 00 00 00 02 00 01',
    decoded: [
      sec('PFCP Session Establishment Response', [
        sec('PFCP header', [
          enm('version', '1'),
          boo('S', true),
          hex('message-type', '0x33'),
          num('length', 298),
          num('seid', 1),
          num('sequence-number', 1),
        ]),
        sec('Cause (IE)', [enm('value', 'Request accepted')]),
        sec('Node ID (IE)', [
          enm('node-id-type', 'FQDN'),
          str('fqdn', 'upf-01.core.rakuten.local'),
        ]),
        sec('F-SEID (IE)', [
          str('ipv4', '10.20.3.1'),
          num('seid', 2),
        ]),
        sec('Created PDR[1] (IE)', [
          num('pdr-id', 1),
          sec('F-TEID', [
            boo('CH', false),
            str('ipv4', '10.20.3.1'),
            hex('teid', '0x00000001'),
          ]),
          sec('UE IP address', [str('ipv4', '10.45.0.23')]),
        ]),
      ]),
    ],
  },
  // ── 29. Nsmf_PDUSession_CreateSMContext Response ──────────────────────────
  {
    seq: 29, timestamp: ts(73),
    from: 'SMF', to: 'AMF', iface: 'N11', protocol: 'HTTP2', status: 'ok', byteLen: 195,
    name: 'Nsmf_PDUSession CreateSMContext Response (201 Created)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 201 Created', [
        str(':status', '201'),
        str('location', '/nsmf-pdusession/v1/sm-contexts/1'),
        sec('body (SmContextCreatedData)', [
          str('smContextRef', '/nsmf-pdusession/v1/sm-contexts/1'),
          sec('pduSessionId', [num('value', 1)]),
          sec('allocatedEbiList[0]', [num('ebi', 5)]),
          sec('upCnxState', [enm('value', 'ACTIVATING')]),
        ]),
      ]),
    ],
  },
  // ── 30. PDU Session Resource Setup Request ────────────────────────────────
  {
    seq: 30, timestamp: ts(76),
    from: 'AMF', to: 'gNB', iface: 'N2', protocol: 'NGAP', status: 'ok', byteLen: 355,
    name: 'PDU Session Resource Setup Request',
    rawHex: '00 1d 40 ba 00 00 03 00 00 00 06 40 04 00 00 00 01',
    decoded: [
      sec('NGAP PDUSessionResourceSetupRequest', [
        num('AMF-UE-NGAP-ID', 1),
        num('RAN-UE-NGAP-ID', 1001),
        sec('PDUSessionResourceSetupListSUReq[0]', [
          num('pDUSessionID', 1),
          sec('pDUSessionNAS-PDU (PDU Session Est. Accept)', [
            str('see', 'decoded in seq 31'),
          ]),
          sec('pDUSessionResourceSetupRequestTransfer', [
            sec('pDUSessionAggregateMaximumBitRate', [
              str('pDUSessionAggregateMaximumBitRateDL', '400 Mbps'),
              str('pDUSessionAggregateMaximumBitRateUL', '100 Mbps'),
            ]),
            sec('uL-NGU-UP-TNLInformation', [
              str('gTPTunnel.transportLayerAddress', '10.20.3.1'),
              hex('gTPTunnel.gTP-TEID', '0x00000001'),
            ]),
            sec('pDUSessionType', [enm('value', 'ipv4')]),
            sec('qosFlowSetupRequestList[0]', [
              num('qosFlowIdentifier', 1),
              sec('qosFlowLevelQosParameters', [
                num('qosCharacteristics.nonDynamic5QI.fiveQI', 9),
                enm('allocationAndRetentionPriority.priorityLevelARP', '8'),
              ]),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 31. PDU Session Establishment Accept (in RRC Reconfiguration) ─────────
  {
    seq: 31, timestamp: ts(80),
    from: 'gNB', to: 'UE', iface: 'Uu', protocol: 'RRC', status: 'ok', byteLen: 285,
    name: 'RRC Reconfiguration (PDU Session Est. Accept)',
    rawHex: '00 08 40 02 01 04 03 01 08',
    decoded: [
      sec('RRC Reconfiguration', [
        num('rrc-TransactionIdentifier', 1),
        sec('criticalExtensions.rrcReconfiguration', [
          sec('dedicatedNAS-MessageList[0] (PDU Session Est. Accept)', [
            sec('NAS-5GS PDU Session Establishment Accept', [
              hex('epd', '0x7E'),
              hex('message-type', '0xC2'),
              num('pdu-session-id', 1),
              enm('pdu-session-type', 'IPv4'),
              num('ssc-mode', 1),
              sec('qos-rules[0]', [
                num('qos-rule-id', 1),
                enm('rule-operation-code', 'create-new-QoS-rule'),
                boo('dqr', true),
                num('qfi', 1),
              ]),
              sec('Authorized QoS flow descriptions[0]', [
                num('qfi', 1),
                enm('5qi', '9 (Non-GBR)'),
              ]),
              sec('PDU address', [str('ipv4', '10.45.0.23')]),
              sec('DNN', [str('value', 'internet.rakuten.co.jp')]),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 32. RRC Reconfiguration Complete ─────────────────────────────────────
  {
    seq: 32, timestamp: ts(83),
    from: 'UE', to: 'gNB', iface: 'Uu', protocol: 'RRC', status: 'ok', byteLen: 10,
    name: 'RRC Reconfiguration Complete',
    rawHex: '00 08 80 01',
    decoded: [
      sec('RRC Reconfiguration Complete', [
        num('rrc-TransactionIdentifier', 1),
      ]),
    ],
  },
  // ── 33. PDU Session Resource Setup Response ───────────────────────────────
  {
    seq: 33, timestamp: ts(85),
    from: 'gNB', to: 'AMF', iface: 'N2', protocol: 'NGAP', status: 'ok', byteLen: 295,
    name: 'PDU Session Resource Setup Response',
    rawHex: '20 1d 40 72 00 00 02 00 00 00 06 40 04 00 00 00 01',
    decoded: [
      sec('NGAP PDUSessionResourceSetupResponse', [
        num('AMF-UE-NGAP-ID', 1),
        num('RAN-UE-NGAP-ID', 1001),
        sec('PDUSessionResourceSetupListSURes[0]', [
          num('pDUSessionID', 1),
          sec('pDUSessionResourceSetupResponseTransfer', [
            sec('dL-NGU-UP-TNLInformation', [
              str('gTPTunnel.transportLayerAddress', '10.10.1.1'),
              hex('gTPTunnel.gTP-TEID', '0x00000002'),
            ]),
            sec('qosFlowPerTNLInformation', [
              sec('associatedQosFlowList[0]', [
                num('qosFlowIdentifier', 1),
              ]),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 34. GTP-U: UE Data Path Active ───────────────────────────────────────
  {
    seq: 34, timestamp: ts(88),
    from: 'UE', to: 'UPF', iface: 'N3', protocol: 'GTP-U', status: 'ok', byteLen: 84,
    name: 'GTP-U Data Path Active (first uplink packet)',
    rawHex: '30 ff 00 4c 00 00 00 01',
    decoded: [
      sec('GTP-U header', [
        num('version', 1),
        boo('PT', true),
        boo('E', false),
        boo('S', false),
        boo('PN', false),
        hex('message-type', '0xFF'),
        num('length', 76),
        hex('TEID', '0x00000001'),
      ]),
      sec('IP payload (inner)', [
        str('src', '10.45.0.23'),
        str('dst', '8.8.8.8'),
        enm('protocol', 'UDP'),
      ]),
    ],
  },
];

// ─── Flow B messages (22 messages — PDF authoritative) ──────────────────────

const BASE_TS_B = '2025-01-15T10:00:00.000Z';

function tsB(offsetMs: number): string {
  return new Date(new Date(BASE_TS_B).getTime() + offsetMs).toISOString();
}

const MSGS_VONR: Omit<LadderMessage, 'id'>[] = [
  // ── 1. SIP REGISTER (UE → P-CSCF) ────────────────────────────────────────
  {
    seq: 1, timestamp: tsB(0),
    from: 'UE', to: 'P-CSCF', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 542,
    name: 'SIP REGISTER',
    rawHex: '',
    decoded: [
      sec('SIP REGISTER Request', [
        str('Request-Line', 'REGISTER sip:ims.rakuten.co.jp SIP/2.0'),
        str('Via', 'SIP/2.0/UDP 10.45.0.23:5060;branch=z9hG4bK-524287-1---b2b3c4'),
        str('From', '<sip:819011111111@ims.rakuten.co.jp>;tag=1234567890'),
        str('To', '<sip:819011111111@ims.rakuten.co.jp>'),
        str('Call-ID', 'abc123def456@10.45.0.23'),
        num('CSeq', 1),
        str('Contact', '<sip:819011111111@10.45.0.23:5060>'),
        str('Expires', '3600'),
        str('P-Access-Network-Info', '3GPP-NR; utran-cell-id-3gpp=44010123456789A'),
        str('Authorization', 'Digest realm="ims.rakuten.co.jp", nonce="", uri="sip:ims.rakuten.co.jp", response=""'),
      ]),
    ],
  },
  // ── 2. SIP 100 Trying (P-CSCF → UE) ─────────────────────────────────────
  {
    seq: 2, timestamp: tsB(3),
    from: 'P-CSCF', to: 'UE', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 285,
    name: 'SIP 100 Trying',
    rawHex: '',
    decoded: [
      sec('SIP 100 Trying', [
        str('Status-Line', 'SIP/2.0 100 Trying'),
        str('Via', 'SIP/2.0/UDP 10.45.0.23:5060;branch=z9hG4bK-524287-1---b2b3c4'),
        str('From', '<sip:819011111111@ims.rakuten.co.jp>;tag=1234567890'),
        str('To', '<sip:819011111111@ims.rakuten.co.jp>'),
        str('Call-ID', 'abc123def456@10.45.0.23'),
        num('CSeq', 1),
      ]),
    ],
  },
  // ── 3. SIP REGISTER (P-CSCF → S-CSCF) ───────────────────────────────────
  {
    seq: 3, timestamp: tsB(5),
    from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 610,
    name: 'SIP REGISTER (forwarded)',
    rawHex: '',
    decoded: [
      sec('SIP REGISTER (P-CSCF → S-CSCF)', [
        str('Request-Line', 'REGISTER sip:ims.rakuten.co.jp SIP/2.0'),
        str('Route', '<sip:scscf.ims.rakuten.co.jp;lr>'),
        str('Path', '<sip:pcscf.ims.rakuten.co.jp;lr>'),
        str('P-Visited-Network-ID', '"ims.rakuten.co.jp"'),
        str('Authorization', 'Digest realm="ims.rakuten.co.jp", nonce="", uri="sip:ims.rakuten.co.jp", response=""'),
      ]),
    ],
  },
  // ── 4. SIP 401 Unauthorized (S-CSCF → P-CSCF) ───────────────────────────
  {
    seq: 4, timestamp: tsB(8),
    from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 390,
    name: 'SIP 401 Unauthorized (IMS AKA challenge)',
    rawHex: '',
    decoded: [
      sec('SIP 401 Unauthorized', [
        str('Status-Line', 'SIP/2.0 401 Unauthorized'),
        str('WWW-Authenticate', 'Digest realm="ims.rakuten.co.jp", qop="auth,auth-int", algorithm=AKAv1-MD5, nonce="base64encodednonce=="'),
      ]),
    ],
  },
  // ── 5. SIP 401 Unauthorized (P-CSCF → UE) ───────────────────────────────
  {
    seq: 5, timestamp: tsB(10),
    from: 'P-CSCF', to: 'UE', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 390,
    name: 'SIP 401 Unauthorized (forwarded to UE)',
    rawHex: '',
    decoded: [
      sec('SIP 401 Unauthorized (P-CSCF → UE)', [
        str('Status-Line', 'SIP/2.0 401 Unauthorized'),
        str('WWW-Authenticate', 'Digest realm="ims.rakuten.co.jp", qop="auth,auth-int", algorithm=AKAv1-MD5, nonce="base64encodednonce=="'),
      ]),
    ],
  },
  // ── 6. SIP REGISTER with Auth (UE → P-CSCF) ──────────────────────────────
  {
    seq: 6, timestamp: tsB(14),
    from: 'UE', to: 'P-CSCF', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 620,
    name: 'SIP REGISTER (with AKA credentials)',
    rawHex: '',
    decoded: [
      sec('SIP REGISTER (authenticated)', [
        str('Request-Line', 'REGISTER sip:ims.rakuten.co.jp SIP/2.0'),
        num('CSeq', 2),
        str('Authorization', 'Digest realm="ims.rakuten.co.jp", nonce="base64encodednonce==", uri="sip:ims.rakuten.co.jp", response="<AKA-computed-response>", algorithm=AKAv1-MD5'),
      ]),
    ],
  },
  // ── 7. SIP REGISTER forwarded authenticated (P-CSCF → S-CSCF) ───────────
  {
    seq: 7, timestamp: tsB(16),
    from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 680,
    name: 'SIP REGISTER (authenticated, forwarded)',
    rawHex: '',
    decoded: [
      sec('SIP REGISTER (authenticated, P-CSCF → S-CSCF)', [
        str('Authorization', 'Digest ... response="<AKA-computed-response>"'),
        str('P-Access-Network-Info', '3GPP-NR; utran-cell-id-3gpp=44010123456789A'),
      ]),
    ],
  },
  // ── 8. SIP 200 OK REGISTER (S-CSCF → P-CSCF) ────────────────────────────
  {
    seq: 8, timestamp: tsB(20),
    from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 425,
    name: 'SIP 200 OK (REGISTER)',
    rawHex: '',
    decoded: [
      sec('SIP 200 OK (REGISTER — S-CSCF → P-CSCF)', [
        str('Status-Line', 'SIP/2.0 200 OK'),
        str('Contact', '<sip:819011111111@10.45.0.23:5060>;expires=3600'),
        str('Service-Route', '<sip:scscf.ims.rakuten.co.jp;lr>'),
        str('P-Associated-URI', '<sip:819011111111@ims.rakuten.co.jp>'),
      ]),
    ],
  },
  // ── 9. SIP 200 OK REGISTER (P-CSCF → UE) ────────────────────────────────
  {
    seq: 9, timestamp: tsB(22),
    from: 'P-CSCF', to: 'UE', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 425,
    name: 'SIP 200 OK (REGISTER forwarded to UE)',
    rawHex: '',
    decoded: [
      sec('SIP 200 OK (REGISTER — P-CSCF → UE)', [
        str('Status-Line', 'SIP/2.0 200 OK'),
        str('Service-Route', '<sip:pcscf.ims.rakuten.co.jp;lr>,<sip:scscf.ims.rakuten.co.jp;lr>'),
        str('P-Associated-URI', '<sip:819011111111@ims.rakuten.co.jp>'),
        str('Expires', '3600'),
      ]),
    ],
  },
  // ── 10. SIP INVITE (UE → P-CSCF) ─────────────────────────────────────────
  {
    seq: 10, timestamp: tsB(25),
    from: 'UE', to: 'P-CSCF', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 892,
    name: 'SIP INVITE',
    rawHex: '',
    decoded: [
      sec('SIP INVITE', [
        str('Request-Line', 'INVITE sip:819022222222@ims.rakuten.co.jp SIP/2.0'),
        str('From', '<sip:819011111111@ims.rakuten.co.jp>;tag=inv-tag-001'),
        str('To', '<sip:819022222222@ims.rakuten.co.jp>'),
        str('Call-ID', 'inv-abc123@10.45.0.23'),
        num('CSeq', 1),
        str('Route', '<sip:pcscf.ims.rakuten.co.jp;lr>,<sip:scscf.ims.rakuten.co.jp;lr>'),
        str('P-Preferred-Identity', '<sip:819011111111@ims.rakuten.co.jp>'),
        sec('SDP body', [
          str('v', '0'),
          str('o', '- 1234567890 1234567890 IN IP4 10.45.0.23'),
          str('s', '-'),
          str('c', 'IN IP4 10.45.0.23'),
          str('t', '0 0'),
          sec('m=audio 50000 RTP/AVP 98 99', [
            str('a=rtpmap:98', 'AMR-WB/16000'),
            str('a=rtpmap:99', 'telephone-event/16000'),
            str('a=sendrecv', ''),
          ]),
        ]),
      ]),
    ],
  },
  // ── 11. Npcf_SMPolicyControl Update (GBR bearer) ──────────────────────────
  {
    seq: 11, timestamp: tsB(30),
    from: 'SMF', to: 'PCF', iface: 'N7', protocol: 'HTTP2', status: 'ok', byteLen: 188,
    name: 'Npcf_SMPolicyControl Update Request (GBR for VoNR)',
    rawHex: '',
    decoded: [
      sec('HTTP/2 POST /npcf-smpolicycontrol/v1/sm-policies/{smPolicyId}/update', [
        str(':method', 'POST'),
        str(':path', '/npcf-smpolicycontrol/v1/sm-policies/imsi-440100000000001-1/update'),
        sec('body (SmPolicyUpdateContextData)', [
          str('trigger', 'RES_MO_RE'),
          sec('repPolicyCtrlReqTriggers[0]', [
            enm('value', 'APP_STA'),
          ]),
          sec('ueInitiatedResReq', [
            num('pduSessionId', 1),
            sec('reqQosFlows[0]', [
              num('qfi', 2),
              sec('qosFlowLevelQosParameters', [
                num('fiveQI', 1),
                sec('gbrQosFlowInfo', [
                  str('maxFbrUl', '100 kbps'),
                  str('maxFbrDl', '100 kbps'),
                  str('guaranteedFbrUl', '64 kbps'),
                  str('guaranteedFbrDl', '64 kbps'),
                ]),
              ]),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 12. PFCP Session Modification (activate GBR bearer) ──────────────────
  {
    seq: 12, timestamp: tsB(33),
    from: 'SMF', to: 'UPF', iface: 'N4', protocol: 'PFCP', status: 'ok', byteLen: 280,
    name: 'PFCP Session Modification Request (GBR QER for QFI=2)',
    rawHex: '21 34 01 18 00 00 00 01 00 00 00 02',
    decoded: [
      sec('PFCP Session Modification Request', [
        sec('header', [
          boo('S', true),
          hex('message-type', '0x34'),
          num('seid', 2),
          num('sequence-number', 2),
        ]),
        sec('Create QER[2] (GBR)', [
          num('qer-id', 2),
          enm('gate-status', 'OPEN/OPEN'),
          sec('MBR', [str('ul', '100 kbps'), str('dl', '100 kbps')]),
          sec('GBR', [str('ul', '64 kbps'), str('dl', '64 kbps')]),
          num('qfi', 2),
        ]),
        sec('Update PDR[3]', [
          num('pdr-id', 3),
          num('qer-id', 2),
        ]),
      ]),
    ],
  },
  // ── 13. SIP INVITE forwarded (P-CSCF → S-CSCF) ───────────────────────────
  {
    seq: 13, timestamp: tsB(36),
    from: 'P-CSCF', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 960,
    name: 'SIP INVITE (forwarded to S-CSCF)',
    rawHex: '',
    decoded: [
      sec('SIP INVITE (P-CSCF → S-CSCF)', [
        str('Request-Line', 'INVITE sip:819022222222@ims.rakuten.co.jp SIP/2.0'),
        str('P-Asserted-Identity', '<sip:819011111111@ims.rakuten.co.jp>'),
        str('P-Called-Party-ID', '<sip:819022222222@ims.rakuten.co.jp>'),
        str('Record-Route', '<sip:scscf.ims.rakuten.co.jp;lr>,<sip:pcscf.ims.rakuten.co.jp;lr>'),
      ]),
    ],
  },
  // ── 14. SIP INVITE (S-CSCF → UE-B via P-CSCF) ───────────────────────────
  {
    seq: 14, timestamp: tsB(40),
    from: 'S-CSCF', to: 'UE-B', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 960,
    name: 'SIP INVITE (S-CSCF → UE-B)',
    rawHex: '',
    decoded: [
      sec('SIP INVITE (S-CSCF → UE-B)', [
        str('Request-Line', 'INVITE sip:819022222222@10.45.0.24:5060 SIP/2.0'),
        str('P-Asserted-Identity', '<sip:819011111111@ims.rakuten.co.jp>'),
        str('Contact', '<sip:scscf.ims.rakuten.co.jp>'),
      ]),
    ],
  },
  // ── 15. SIP ACK forwarded to UE-B (PDF-only — synthesized) ──────────────
  {
    seq: 15, timestamp: tsB(2200),
    from: 'P-CSCF', to: 'UE-B', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 245,
    name: 'SIP ACK (forwarded to UE-B)',
    rawHex: '',
    decoded: [
      sec('SIP ACK', [
        str('Request-Line', 'ACK sip:819022222222@10.45.0.24:5060 SIP/2.0'),
        str('Route', '<sip:scscf.ims.rakuten.co.jp;lr>,<sip:pcscf.ims.rakuten.co.jp;lr>'),
        str('Call-ID', 'inv-abc123@10.45.0.23'),
        num('CSeq', 1),
      ]),
    ],
  },
  // ── 16. SIP 200 OK INVITE (UE-B → S-CSCF) ───────────────────────────────
  {
    seq: 16, timestamp: tsB(2212),
    from: 'UE-B', to: 'S-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 540,
    name: 'SIP 200 OK (INVITE — UE-B answers)',
    rawHex: '',
    decoded: [
      sec('SIP 200 OK (INVITE)', [
        str('Status-Line', 'SIP/2.0 200 OK'),
        str('Contact', '<sip:819022222222@10.45.0.24:5060>'),
        sec('SDP body (UE-B answer)', [
          str('c', 'IN IP4 10.45.0.24'),
          sec('m=audio 50002 RTP/AVP 98', [
            str('a=rtpmap:98', 'AMR-WB/16000'),
            str('a=sendrecv', ''),
          ]),
        ]),
      ]),
    ],
  },
  // ── 17. PFCP Session Mod — FAR-3 Activate (PDF-only — synthesized) ───────
  {
    seq: 17, timestamp: tsB(2215),
    from: 'SMF', to: 'UPF', iface: 'N4', protocol: 'PFCP', status: 'ok', byteLen: 195,
    name: 'PFCP Session Modification (Activate FAR-3 for gNB TEID)',
    rawHex: '21 34 00 c3 00 00 00 01 00 00 00 02',
    decoded: [
      sec('PFCP Session Modification Request (FAR-3 activation)', [
        sec('header', [
          boo('S', true),
          hex('message-type', '0x34'),
          num('seid', 2),
          num('sequence-number', 3),
        ]),
        sec('Update FAR[3]', [
          num('far-id', 3),
          enm('apply-action', 'FORW'),
          sec('Update Forwarding Parameters', [
            enm('destination-interface', 'Access'),
            sec('Outer Header Creation', [
              enm('description', 'GTP-U/UDP/IPv4'),
              str('ipv4-address', '10.10.1.1'),
              hex('teid', '0x00000002'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  // ── 18. SIP 200 OK INVITE forwarded (S-CSCF → P-CSCF → UE) ──────────────
  {
    seq: 18, timestamp: tsB(2218),
    from: 'S-CSCF', to: 'P-CSCF', iface: 'ISC', protocol: 'SIP', status: 'ok', byteLen: 540,
    name: 'SIP 200 OK (INVITE, forwarded via S-CSCF)',
    rawHex: '',
    decoded: [
      sec('SIP 200 OK (INVITE — S-CSCF → P-CSCF)', [
        str('Status-Line', 'SIP/2.0 200 OK'),
        str('Record-Route', '<sip:scscf.ims.rakuten.co.jp;lr>,<sip:pcscf.ims.rakuten.co.jp;lr>'),
        sec('SDP (UE-B answer)', [
          str('c', 'IN IP4 10.45.0.24'),
          str('m=audio', '50002 RTP/AVP 98'),
        ]),
      ]),
    ],
  },
  // ── 19. SIP 200 OK INVITE (P-CSCF → UE) ─────────────────────────────────
  {
    seq: 19, timestamp: tsB(2220),
    from: 'P-CSCF', to: 'UE', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 540,
    name: 'SIP 200 OK (INVITE, forwarded to UE-A)',
    rawHex: '',
    decoded: [
      sec('SIP 200 OK (INVITE — P-CSCF → UE-A)', [
        str('Status-Line', 'SIP/2.0 200 OK'),
        str('Contact', '<sip:819022222222@10.45.0.24:5060>'),
        sec('SDP answer', [
          str('c', 'IN IP4 10.45.0.24'),
          str('m=audio', '50002 RTP/AVP 98'),
          str('a=rtpmap:98', 'AMR-WB/16000'),
        ]),
      ]),
    ],
  },
  // ── 20. SIP ACK (UE → P-CSCF) ────────────────────────────────────────────
  {
    seq: 20, timestamp: tsB(2224),
    from: 'UE', to: 'P-CSCF', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 220,
    name: 'SIP ACK',
    rawHex: '',
    decoded: [
      sec('SIP ACK (UE-A → P-CSCF)', [
        str('Request-Line', 'ACK sip:819022222222@10.45.0.24:5060 SIP/2.0'),
        str('Call-ID', 'inv-abc123@10.45.0.23'),
        num('CSeq', 1),
        str('Route', '<sip:pcscf.ims.rakuten.co.jp;lr>,<sip:scscf.ims.rakuten.co.jp;lr>'),
      ]),
    ],
  },
  // ── 21. RTP Media stream established ─────────────────────────────────────
  {
    seq: 21, timestamp: tsB(2228),
    from: 'UE', to: 'UE-B', iface: 'N3', protocol: 'RTP', status: 'ok', byteLen: 172,
    name: 'RTP Media Stream (AMR-WB active)',
    rawHex: '80 62 00 01 00 00 00 00 12 34 56 78',
    decoded: [
      sec('RTP header', [
        num('version', 2),
        boo('padding', false),
        boo('extension', false),
        num('CC', 0),
        boo('marker', false),
        num('payload-type', 98),
        num('sequence-number', 1),
        num('timestamp', 0),
        hex('SSRC', '0x12345678'),
      ]),
      sec('RTP payload (AMR-WB frame)', [
        enm('codec', 'AMR-WB/16000'),
        num('frame-size', 160),
      ]),
    ],
  },
  // ── 22. SIP BYE (call teardown) ───────────────────────────────────────────
  {
    seq: 22, timestamp: tsB(144200),
    from: 'UE', to: 'P-CSCF', iface: 'Gm', protocol: 'SIP', status: 'ok', byteLen: 280,
    name: 'SIP BYE (call teardown)',
    rawHex: '',
    decoded: [
      sec('SIP BYE', [
        str('Request-Line', 'BYE sip:819022222222@10.45.0.24:5060 SIP/2.0'),
        str('Call-ID', 'inv-abc123@10.45.0.23'),
        num('CSeq', 2),
        str('Reason', 'SIP ;cause=200 ;text="Normal call clearing"'),
      ]),
    ],
  },
];

// ─── Attach IDs ─────────────────────────────────────────────────────────────

function attachIds(msgs: Omit<LadderMessage, 'id'>[], prefix: string): LadderMessage[] {
  return msgs.map((m, i) => ({ ...m, id: `${prefix}-msg-${String(i + 1).padStart(3, '0')}` }));
}

// ─── Exported base sessions ──────────────────────────────────────────────────

export const DEMO_FLOW_5GSA: Session = {
  id:            'demo-a1-base',
  created_at:    BASE_TS,
  timestamp:     BASE_TS,
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
  dpi: {
    appId:       'internet.rakuten',
    appCategory: 'Web/Data',
    dpi_flows:   [
      { qfi: 6, fiveQI: 9, type: 'Non-GBR' as const, pdb: 300 },
    ],
    bytesUl:   524288,
    bytesDl:   2097152,
    packetsUl: 374,
    packetsDl: 1497,
    latencyMs: 8,
    anomalies: [],
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
