# NIxTrace — 5G SA Session & Packet Analyzer

## Overview
Professional Wireshark-style UI for analyzing 5G SA (Standalone Architecture) sessions.
Built for Rakuten 5G SA demo on the NIx Platform.

**Stack:** React 19 · TypeScript · Vite 8 · Supabase Realtime · Zustand · @tanstack/react-virtual

---

## Quick Start

### Offline mode (no Supabase required)
```bash
cd nixtrace
npm install
npm run dev          # → http://localhost:5173
```
The app self-seeds with synthetic 5G SA sessions every 800–1500ms. TopBar shows **LOCAL** in amber.

### Live mode (with Supabase)
1. Fill in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_KEY=eyJ...
   ```
2. Run the Supabase SQL schema (see below)
3. `npm run demo` — starts Vite + seed script concurrently

---

## NPM Scripts
| Script | Purpose |
|---|---|
| `npm run dev`   | Vite dev server only (offline mode) |
| `npm run seed`  | Seed script only (inserts to Supabase) |
| `npm run demo`  | Both concurrently (full live mode) |
| `npm run build` | Production build |

---

## Supabase Setup

### Region
`ap-northeast-1` (Tokyo)

### SQL Schema
Run once in the Supabase SQL editor:

```sql
create table public.sessions (
  id            text primary key,
  created_at    timestamptz default now(),
  timestamp     text        not null,
  imsi          text        not null,
  msisdn        text,
  procedure     text        not null,
  primary_iface text        not null,
  slice         text        not null,
  duration_ms   integer     not null,
  status        text        not null check (status in ('ok','err','warn')),
  gnb           text        not null,
  amf           text        not null,
  smf           text,
  upf           text,
  nfs           jsonb       not null default '[]',
  messages      jsonb       not null default '[]',
  kpis          jsonb       not null default '{}'
);

-- Indexes
create index on public.sessions(status);
create index on public.sessions(slice);
create index on public.sessions(procedure);
create index on public.sessions(created_at desc);

-- Realtime
alter publication supabase_realtime add table public.sessions;

-- RLS (open policy for demo)
alter table public.sessions enable row level security;
create policy "allow_all" on public.sessions for all using (true) with check (true);

-- Trim function (keeps last 500 rows)
create or replace function trim_sessions() returns trigger language plpgsql as $$
begin
  delete from public.sessions
  where id in (
    select id from public.sessions
    order by created_at desc
    offset 500
  );
  return null;
end;
$$;
create trigger trim_sessions_trigger
after insert on public.sessions
for each statement execute function trim_sessions();
```

---

## Architecture

```
nixtrace/
├── src/
│   ├── types/
│   │   ├── session.types.ts        All TypeScript types
│   │   └── save-svg-as-png.d.ts    Type shim for untyped package
│   ├── data/
│   │   ├── procedures.ts           9 5G SA procedure definitions (NF columns + message templates)
│   │   └── sessionGenerator.ts     Pure fn — generateSession() → Session
│   ├── lib/
│   │   └── supabaseClient.ts       Nullable client + isOfflineMode flag
│   ├── store/
│   │   └── nixStore.ts             Zustand: sessions (FIFO 500), selection, filter, live mode
│   ├── hooks/
│   │   ├── useRealtimeSessions.ts  Supabase INSERT subscribe + offline timer fallback
│   │   └── useFilteredSessions.ts  useMemo client-side filter
│   ├── components/
│   │   ├── TopBar/                 Logo · connection dot · scenario bookmarks · live toggle · clock
│   │   ├── FilterBar/              IMSI input · Interface/Status/Slice/Procedure dropdowns
│   │   ├── SessionTable/           @tanstack/react-virtual · 28px rows · status borders
│   │   ├── LadderDiagram/          SVG-native · NF circles · message arrows · PNG export
│   │   ├── MessageDecode/          3-panel: msg list / decode tree / hex dump
│   │   └── SessionKPIs/            Metric cards · context table · timeline bar
│   ├── App.tsx                     Layout + tab routing
│   └── index.css                   CSS variables (dark theme)
└── scripts/
    └── seed.ts                     Live feed generator — inserts via service key
```

### Key Design Decisions

**No custom backend.** Vite dev server + seed script only. Supabase handles DB, realtime, and REST.

**Offline mode.** `isOfflineMode` exported from `supabaseClient.ts`. When `.env.local` is absent or has placeholder values, the app runs fully locally. `useRealtimeSessions` falls back to `setTimeout` loop calling `generateSession()`.

**SVG LadderDiagram uses hardcoded color constants.** `save-svg-as-png` serializes the SVG DOM — CSS custom properties are not inlined, so they'd produce empty strings. All SVG colors are defined as `const C = { ok: '#1D9E75', ... }` at the top of `LadderDiagram.tsx`.

**liveMode stale closure prevention.** The Supabase `postgres_changes` subscription is registered once (`[]` deps). A `useRef` tracks the current `liveMode` value, updated by a separate `useEffect`. The subscription callback reads from the ref.

**Virtual scroll (SessionTable).** `@tanstack/react-virtual` with `estimateSize: () => 28`. New rows trigger a "↑ N new" badge if the user is scrolled down > 50px.

---

## Synthetic Data Parameters

| Parameter | Value |
|---|---|
| IMSI pool | 50 IMSIs — MCC-MNC 440-10 (Rakuten Japan) |
| gNB pool | gNB-RAK-01…05 (Shinagawa, Shibuya, Shinjuku, Akihabara, Roppongi) |
| AMF pool | AMF-01 (10.20.1.1), AMF-02 (10.20.1.2) |
| SMF pool | SMF-01 (10.20.2.1), SMF-02 (10.20.2.2) |
| UPF pool | UPF-01 (10.20.3.1), UPF-02 (10.20.3.2) |
| Procedure weights | PDU Est 35% · Registration 30% · Handover 15% · others spread |
| Error rate | ~8% err · ~5% warn |
| Seed interval | 800–1500ms |
| uRLLC Handover latency | Forced ≤ 40ms |

### 5G SA Procedures
| Procedure | NF Columns | Msgs | Error point |
|---|---|---|---|
| Registration | UE, gNB, AMF, AUSF, UDM | 12 | Auth Response (#5) |
| PDU Session Establishment | UE, gNB, AMF, SMF, UPF | 10 | N4 PFCP (#7) |
| PDU Session Modification | UE, gNB, AMF, SMF | 7 | QoS decision (#5) |
| PDU Session Release | UE, gNB, AMF, SMF, UPF | 6 | PFCP deletion (#4) |
| Deregistration | UE, gNB, AMF | 5 | — |
| Authentication Failure | UE, gNB, AMF, AUSF | 5 | All err |
| Handover (Xn) | UE, gNB-SRC, gNB-TGT, AMF | 6 | Path Switch (#5) |
| Service Request | UE, gNB, AMF | 6 | Service Reject (#4) |
| UE Config Update | UE, gNB, AMF | 4 | NACK (#3) |

---

## Color Palette

| Token | Hex | Use |
|---|---|---|
| `--bg-main` | `#1A1D23` | Primary background |
| `--bg-sidebar` | `#12141A` | TopBar, FilterBar, tab bars |
| `--bg-panel` | `#0E1016` | Decode panels, hex dump |
| `--border` | `#2A2D36` | All dividers |
| `--accent-green` | `#1D9E75` | OK, selected, live |
| `--accent-red` | `#E24B4A` | Error |
| `--accent-amber` | `#E5A234` | Warning, LOCAL mode |
| `--accent-blue` | `#185FA5` | NAS decode keys |
| `--font-mono` | JetBrains Mono | All data/values |
| `--font-ui` | Inter | Labels, UI |

---

## Demo Scenarios (TopBar bookmarks)

| Scenario | Filter applied | Purpose |
|---|---|---|
| A · Auth Failure | status=err + procedure=Auth Failure | Surface 5GMM Cause #20 — sub-30ms detection |
| B · uRLLC Handover | slice=uRLLC + procedure=Handover (Xn) | Sub-40ms Xn handover ladder |
| C · PDU Lifecycle | none (auto-select PDU Est. session) | Full N1/N2/N11/N4 walk-through |
