# NIxTrace — 5G SA Session & Packet Analyzer

Professional Wireshark-style UI for real-time analysis of 5G Standalone sessions and signaling flows. Built for the Rakuten 5G SA demo on the NIx Platform.

![Stack](https://img.shields.io/badge/React_19-TypeScript-blue) ![Supabase](https://img.shields.io/badge/Supabase-Realtime-green) ![3GPP](https://img.shields.io/badge/3GPP-5G_SA-orange)

---

## Features

- **Live session feed** — Supabase Realtime `postgres_changes` subscription with FIFO-capped buffer (configurable, default 500 sessions)
- **Offline mode** — fully self-seeding with synthetic 5G SA sessions when no Supabase credentials are present
- **Ladder Diagram** — SVG-native signal flow diagram with NF columns, protocol arrows, relative timestamps and PNG export
- **Message Decode** — 3-panel inspector: message list / recursive decode tree / Wireshark-style hex dump
- **Session KPIs** — metric cards, 5GMM cause codes, subscriber trace drill-down by IMSI
- **DPI / User Plane** — QoS flow table (QFI/5QI/GBR), MOS score for VoNR, throughput bars, anomaly detection
- **Trigger-based capture** — rule engine (field/operator/value) with cyclic buffer, per-rule enable/disable
- **Multi-format export** — PCAP (libpcap with correct transport per protocol), HTML report, XSIF (3GPP XML)
- **Dark / light theme** — persistent toggle, preference stored in localStorage
- **Interface filter** — filters sessions by message-level interface (Uu / N1 / N2 / N4 / N11 / NG / Xn)

### 5G SA Procedures covered

| Procedure | Interfaces | Protocols |
|---|---|---|
| Registration | Uu, N1, N2, NG | NAS, NGAP, HTTP/2 |
| PDU Session Establishment | N1, N4, N11, NG | NAS, NGAP, PFCP, HTTP/2 |
| PDU Session Modification | N1, N4, N11 | NAS, PFCP, HTTP/2 |
| PDU Session Release | N1, N4, N11 | NAS, PFCP, HTTP/2 |
| Deregistration | Uu, N1, N2 | NAS, NGAP |
| Authentication Failure | N1, N2, NG | NAS, NGAP, HTTP/2 |
| Handover (Xn) | Uu, NG, Xn | NAS, NGAP, XnAP |
| Service Request | N1, NG | NAS, NGAP |
| UE Config Update | N1 | NAS |
| VoNR Session Setup | N1, N4, N11 | NAS, SIP, RTP, HTTP/2 |
| VoNR Session Release | N1, N4, N11 | NAS, SIP, RTCP, HTTP/2 |

### PCAP transport (Wireshark-compatible)

| Protocol | Transport |
|---|---|
| NGAP / NAS | SCTP / port 38412, PPID=60 |
| XnAP | SCTP / port 38422, PPID=61 |
| PFCP | UDP / port 8805 |
| SIP | UDP / port 5060 |
| RTP | UDP / port 49170 |
| RTCP | UDP / port 49171 |
| HTTP/2 (SBI) | TCP / port 8080 |

---

## Quick Start

### Offline mode (no Supabase required)

```bash
cd nixtrace
npm install
npm run dev        # → http://localhost:5173
```

The app self-seeds with synthetic sessions every 800–1500ms. The TopBar shows **LOCAL** in amber.

### Live mode (with Supabase)

1. Copy `.env.local.example` to `.env.local` and fill in your credentials:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_KEY=eyJ...
   ```
2. Run the SQL schema in your Supabase project (see `CLAUDE.md`)
3. Start both the dev server and seed script:
   ```bash
   npm run demo
   ```

The TopBar shows **LIVE** in green and sessions stream in via WebSocket.

### NPM scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (offline mode) |
| `npm run seed` | Seed script only — inserts synthetic sessions into Supabase |
| `npm run demo` | Dev server + seed script concurrently |
| `npm run build` | Production build |

---

## Architecture

```
src/
├── types/session.types.ts       All TypeScript types
├── data/
│   ├── procedures.ts            11 5G SA procedure definitions
│   └── sessionGenerator.ts      generateSession() → Session (NAS/PFCP byte encoding)
├── lib/
│   ├── supabaseClient.ts        Nullable client + isOfflineMode flag
│   └── exportFormats.ts         PCAP / HTML / XSIF export
├── store/nixStore.ts            Zustand: sessions, filter, theme, triggers
├── hooks/
│   ├── useRealtimeSessions.ts   Supabase subscribe + offline timer fallback
│   └── useFilteredSessions.ts   useMemo client-side filter
└── components/
    ├── TopBar/                  Logo · connection · scenarios · theme toggle · clock
    ├── FilterBar/               IMSI input · Interface/Status/Slice/Procedure dropdowns
    ├── SessionTable/            @tanstack/react-virtual · 28px rows · status borders
    ├── LadderDiagram/           SVG · NF columns · message arrows · PNG export
    ├── MessageDecode/           Message list / decode tree / hex dump
    ├── SessionKPIs/             Metric cards · context table · timeline bar
    ├── DPIPanel/                QoS flows · MOS · throughput · anomaly detection
    ├── ExportMenu/              PCAP / HTML / XSIF download
    └── TriggerModal/            Cyclic buffer config · capture rules
```

### Key design decisions

**No custom backend.** Vite dev server + Supabase only. The seed script inserts via the service key (bypasses RLS).

**Offline mode is the default.** If `.env.local` is absent or has placeholder values, `isOfflineMode = true` and `useRealtimeSessions` falls back to a `setTimeout` loop.

**SVG LadderDiagram uses hardcoded color constants.** `save-svg-as-png` serializes the SVG DOM — CSS custom properties resolve to empty strings during serialization. Both dark and light palettes are defined as explicit constant objects (`DARK_C` / `LIGHT_C`).

**NAS bytes follow TS 24.501.** `generateSession()` produces correct mandatory IEs for Registration Request (SUCI with BCD-encoded MCC/MNC/MSIN), Authentication Request (RAND + AUTN), Security Mode Command/Complete, 5G-GUTI in Registration Accept, and 5GSM EPD (0x2e) for PDU Session messages.

**PFCP bytes follow TS 29.244.** Header: version=1, S=1 (SEID present), correct message type (0x32–0x37), length, 8-byte SEID, sequence number.

---

## Demo Scenarios

| Scenario | Filter | Purpose |
|---|---|---|
| A · Auth Failure | status=ERR + procedure=Authentication Failure | Surface 5GMM Cause — sub-30ms detection |
| B · uRLLC Handover | slice=uRLLC + procedure=Handover (Xn) | Sub-40ms Xn handover ladder |
| C · PDU Lifecycle | none | Full N1/N2/N11/N4 signal flow |

---

## Supabase Setup

Run once in the Supabase SQL editor. Full schema in `CLAUDE.md`.

The database uses a Postgres trigger (`trim_sessions_trigger`) that keeps only the last 500 rows — the table behaves as a circular buffer regardless of how long the seed script runs.

Realtime is enabled via:
```sql
alter publication supabase_realtime add table public.sessions;
```

---

## Synthetic Data

| Parameter | Value |
|---|---|
| IMSI pool | 50 subscribers — MCC-MNC 440-10 (Rakuten Japan) |
| gNB pool | gNB-RAK-01…05 (Shinagawa, Shibuya, Shinjuku, Akihabara, Roppongi) |
| AMF pool | AMF-01 (10.20.1.1), AMF-02 (10.20.1.2) |
| Error rate | ~8% ERR · ~5% WARN |
| Seed interval | 800–1500ms |
| uRLLC Handover | Forced ≤ 40ms duration |
| VoNR MOS | 4.1–4.5 (OK) · 2.8–3.5 (WARN) · 1.2–2.2 (ERR) |
