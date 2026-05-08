// Deno-compatible demo scenario generator
// Uses crypto.randomUUID() — no npm packages needed

import { DEMO_FLOW_5GSA, DEMO_FLOW_VONR, Session } from './demoFlows.ts';

const USER_POOL = [
  { imsi: '440100000000001', msisdn: '819011111111' },
  { imsi: '440100000000002', msisdn: '819022222222' },
  { imsi: '440100000000003', msisdn: '819033333333' },
  { imsi: '440100000000004', msisdn: '819012345678' },
  { imsi: '440100000000005', msisdn: '819055555555' },
  { imsi: '440100000000006', msisdn: '819066666666' },
  { imsi: '440100000000007', msisdn: '819077777777' },
  { imsi: '440100000000008', msisdn: '819088888888' },
  { imsi: '440100000000009', msisdn: '819099999999' },
  { imsi: '440100000000010', msisdn: '819011111110' },
];

const UE_IPS = ['10.45.0.23', '10.45.0.31', '10.45.0.44', '10.45.0.57', '10.45.0.68'];

type Scenario = 'A1' | 'A2' | 'A3' | 'A4' | 'B1' | 'B2';

const WEIGHTS: [Scenario, number][] = [
  ['A1', 35],
  ['B1', 25],
  ['A4', 12],
  ['A2', 10],
  ['B2', 10],
  ['A3', 8],
];

function pickWeighted<T>(weights: [T, number][]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) {
    r -= w;
    if (r <= 0) return v;
  }
  return weights[0][0];
}

function shiftIso(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDemoSession(): Session {
  const scenario = pickWeighted(WEIGHTS);
  const user = pick(USER_POOL);
  const ueIp = pick(UE_IPS);
  const now = new Date().toISOString();

  const base = scenario.startsWith('A') ? DEMO_FLOW_5GSA : DEMO_FLOW_VONR;
  const clone = JSON.parse(JSON.stringify(base)) as Session;

  const shortId = crypto.randomUUID().slice(0, 8);
  clone.id = `demo-${scenario.toLowerCase()}-${shortId}`;
  clone.timestamp = now;
  clone.created_at = now;
  clone.imsi = user.imsi;
  clone.msisdn = user.msisdn;

  const baseTime = new Date(base.messages[0]?.timestamp ?? now).getTime();
  clone.messages = clone.messages.map((m) => ({
    ...m,
    id: `${clone.id}-msg-${String(m.seq).padStart(3, '0')}`,
    timestamp: shiftIso(now, new Date(m.timestamp).getTime() - baseTime),
  }));

  switch (scenario) {
    case 'A1': {
      if (clone.kpis.ueIp) clone.kpis.ueIp = ueIp;
      clone.kpis.authRttMs      = 18 + Math.floor(Math.random() * 10);
      clone.kpis.registrationMs = 55 + Math.floor(Math.random() * 15);
      clone.kpis.pduSetupMs     = 28 + Math.floor(Math.random() * 12);
      clone.duration_ms = (clone.kpis.registrationMs ?? 61) + (clone.kpis.pduSetupMs ?? 33);
      clone.kpis.setupTimeMs = clone.duration_ms;
      return clone;
    }

    case 'A2': {
      clone.status = 'err';
      clone.duration_ms = 42;
      clone.messages = clone.messages.slice(0, 12);
      clone.messages[11] = {
        ...clone.messages[11],
        status: 'err',
        name: 'Authentication Response (FAILED — MAC mismatch)',
      };
      clone.kpis = { setupTimeMs: 42, cause5gmm: '21 — MAC failure (AUTN mismatch)', authRttMs: 29 };
      return clone;
    }

    case 'A3': {
      clone.status = 'err';
      clone.duration_ms = 71;
      clone.messages = clone.messages.slice(0, 29);
      clone.messages[27] = {
        ...clone.messages[27],
        status: 'err',
        name: 'PFCP Session Establishment Response (REJECTED — cause 64)',
      };
      clone.kpis = { setupTimeMs: 71, pduSetupMs: 6, authRttMs: 22, registrationMs: 61, sbiCalls: 12, pfcpExchanges: 1 };
      return clone;
    }

    case 'A4': {
      clone.status = 'warn';
      const authSeqs = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15]);
      clone.messages = clone.messages.map((m) =>
        authSeqs.has(m.seq) ? { ...m, timestamp: shiftIso(m.timestamp, 300) } : m,
      );
      clone.messages[6] = { ...clone.messages[6], status: 'warn' };
      clone.duration_ms = 380;
      clone.kpis = { ...clone.kpis, setupTimeMs: 380, authRttMs: 340, registrationMs: 352, pduSetupMs: 28, ueIp: ueIp };
      return clone;
    }

    case 'B1': {
      const mos = +(4.0 + Math.random() * 0.4).toFixed(1);
      clone.kpis.mosScore = mos;
      clone.kpis.imsSetupMs = 20 + Math.floor(Math.random() * 8);
      clone.kpis.callSetupMs = 2100 + Math.floor(Math.random() * 200);
      return clone;
    }

    case 'B2': {
      clone.status = 'warn';
      const jitter = 14 + Math.floor(Math.random() * 8);
      const loss = +(1.2 + Math.random() * 1.2).toFixed(1);
      const mos = +(2.4 + Math.random() * 0.8).toFixed(1);
      clone.kpis = { ...clone.kpis, mosScore: mos, packetLoss: loss };
      if (clone.dpi) {
        clone.dpi.mosScore  = mos;
        clone.dpi.jitterMs  = jitter;
        clone.dpi.packetsDl = Math.round(clone.dpi.packetsDl * (1 - loss / 100));
        clone.dpi.anomalies = [
          `High jitter: ${jitter}ms (threshold 5ms)`,
          `Packet loss ${loss}% on QFI=2 GBR bearer`,
          `MOS below threshold: ${mos} (min 3.5)`,
        ];
      }
      clone.messages = clone.messages.map((m) =>
        m.protocol === 'RTP' ? { ...m, status: 'warn' as const } : m,
      );
      return clone;
    }
  }
}
