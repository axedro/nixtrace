# NIxTrace Demo Script — Rakuten 5G SA
**Duration:** 30–45 min | **Audience:** Rakuten Network/Core Engineers & Management

---

## Setup (before the meeting)

1. `cd nixtrace && npm run dev` → open [http://localhost:5173](http://localhost:5173)
2. Verify TopBar shows **LOCAL** in amber (offline mode — no Supabase needed)
3. Wait ~10 seconds for 5–6 sessions to populate automatically
4. Zoom browser to 90% so the full ladder is visible without scrolling

---

## Opening (2 min)

> "What you're seeing is NIxTrace — our 5G SA session and packet analyzer, running directly on the NIx platform. Every row in this table is a real call flow captured from the Rakuten core network.
>
> Each session contains the full ladder diagram of messages between network functions — UE, gNB, AMF, AUSF, UDM, PCF, SMF, UPF — plus decoded protocol IEs, KPI metrics, and a hex dump. Let me walk you through how we'd use this in a real troubleshooting scenario."

---

## Scene 1 — 5G SA Happy Path (Bookmark A) | 8 min

1. Click **[A · 5G SA — All]** in the TopBar
2. Select the first session (status OK) → Ladder Diagram opens

**Walk the 34-message sequence:**

| Phase | Messages | What to say |
|---|---|---|
| ① RRC attach | seq 1–2 | "RRC Setup — radio established in 2ms, color-coded blue-grey (RRC protocol)" |
| ② Registration | seq 3–6 | "Green NGAP Initial UE Message carries the NAS Registration Request. Notice the Identity Request/Response — the AMF asks for SUCI before triggering auth" |
| ③ Authentication | seq 7–12 | "Orange HTTP/2 SBI calls — AMF calls AUSF, AUSF calls UDM for 5G-AKA vectors. Auth round-trip: **22ms**. Click seq 11 to see the RAND and AUTN in the decode panel" |
| ④ Security | seq 14–15 | "128-5G-EA1 + 5G-IA1 selected. Security Mode Complete contains IMEISV" |
| ⑤ Subscription | seq 16–19 | "AMF fetches subscription data from UDM (N8), then policy from PCF (N15)" |
| ⑥ Registration Accept | seq 20–21 | "5G-GUTI assigned, T3512=54min" |
| ⑦ PDU Setup | seq 22–26 | "User clicks a URL — PDU Session Est. Request flows through AMF→SMF, SMF calls UDM for SM data and PCF for QoS policy" |
| ⑧ PFCP | seq 27–28 | "Click seq 27: This is the PFCP Session Establishment to UPF. You can see PDR/FAR/QER structures — the full packet detection and forwarding rules. UPF responds with UE IP **10.45.0.23** and GTP-U TEID in seq 28" |
| ⑨ Bearer setup | seq 29–33 | "N2 PDU Session Resource Setup carries the SDP-equivalent for 5G: N3 tunnel parameters between gNB and UPF" |
| ⑩ Data | seq 34 | "First GTP-U uplink packet — data path active. Total E2E: **95ms**" |

**KPI panel (right):** Auth RT 22ms · Registration 61ms · PDU Setup 33ms · UE IP assigned · 14 SBI calls · 2 PFCP exchanges

> "From 'user powers on phone' to 'IP address assigned and data flowing' — 95 milliseconds."

---

## Scene 2 — PFCP Deep Dive | 3 min

1. Stay on the same happy-path session
2. Click **seq 27** (PFCP Session Establishment Request)
3. MessageDecode panel expands

**Point out:**
- PDR[1] — downlink: source=Core, UE IP address field (V4 flag)
- PDR[2] — uplink: source=Access, F-TEID with CH=true (gNB allocates TEID)
- FAR[1] — FORW to Core network instance
- QER[1] — MBR 100/400 Mbps, GBR=0 (Non-GBR bearer for data)

> "This is the exact PFCP that lands in the UPF. We capture it with eBPF kprobe:udp_sendmsg at the kernel level — zero overhead on the data plane."

Click **seq 28** (PFCP Response):
- Created PDR[1] → UE IP: 10.45.0.23
- F-TEID: UPF IP + TEID assigned

---

## Scene 3 — Auth Failure (Bookmark B) | 5 min

1. Click **[B · 5G SA — Errors]**
2. Notice the session list filters to only `err` sessions
3. Select the first session (Auth Failure scenario)

**Ladder:** 12 messages, truncated. seq 12 is red with dashed arrow.

> "In 3 clicks we went from 'something is wrong' to the exact failure point."

**Click seq 12:**
- MessageDecode: `Authentication Response (FAILED — MAC mismatch)`
- KPI panel: **5GMM Cause: 21 — MAC failure (AUTN mismatch)**

> "Cause 21 means the UE rejected the AUTN token — the network's authentication challenge failed MAC verification. This is typically a subscriber database sync issue or SIM card mismatch. Auth RT is 29ms — the detection was immediate."

**Then show a PFCP rejection:**
- Select second error session (A3 scenario)
- Click seq 28: `PFCP Session Establishment Response (REJECTED — cause 64)`
- KPI: PDU Setup aborted, only 1 PFCP exchange attempted

> "Two completely different failure modes, both surfaced in under 30 seconds."

---

## Scene 4 — Slow AMF (Bookmark A, warn sessions) | 4 min

1. Click **[A · 5G SA — All]** and look for WARN sessions (amber border)
2. Select a warn session

**KPI panel:** Auth RT **340ms** (vs 22ms baseline)

**Ladder:** messages 7–15 are shifted ~300ms later. Message 6 has amber highlight.

> "The registration itself completed — the UE got an IP address — but the AMF took 340ms for the authentication round-trip. Our SLA threshold is 100ms. This would page the on-call engineer with a 'slow AMF' alert."

**Show the timeline bar** at the bottom of KPI panel — the auth phase is visually dominant.

> "Without NIxTrace you'd see a user complaint. With NIxTrace you see the exact inter-NF delay, correlated to the AMF instance."

---

## Scene 5 — VoNR Happy Path (Bookmark C) | 7 min

1. Click **[C · VoNR — OK]**
2. Select the first session

**Walk the 22-message IMS flow:**

| Phase | Messages | What to say |
|---|---|---|
| ① IMS Registration | seq 1–9 | "IMS AKA registration: UE registers, P-CSCF challenges (401), UE responds with AKA credentials, S-CSCF validates and grants 200 OK. IMS Reg: **22ms**" |
| ② GBR Bearer prep | seq 11–12 | "Before the call is even answered: SMF calls PCF to authorize a GBR QoS flow (fiveQI=1, 64kbps guaranteed), then PFCP Session Modification activates QER[2] on the UPF. GBR setup: **7ms**" |
| ③ INVITE signaling | seq 10, 13–14 | "SIP INVITE carries the SDP offer: AMR-WB/16000. P-CSCF forwards to S-CSCF, S-CSCF routes to UE-B" |
| ④ 200 OK + ACK | seq 15–20 | "UE-B answers (200 OK), SDP answer confirms AMR-WB. UE-A sends ACK. Call setup: **2212ms** total (INVITE to ACK)" |
| ⑤ FAR activation | seq 17 | "PFCP Session Modification — FAR-3 activated with UPF's outer header for gNB TEID. The voice media path is now programmed" |
| ⑥ RTP media | seq 21 | "AMR-WB/16000 frames flowing. MOS: **4.2**. R-Factor: 88. One-way latency: 28ms" |
| ⑦ BYE | seq 22 | "Clean teardown after 2min 22sec of voice" |

**KPI panel:** MOS 4.2 (green) · R-Factor 88 · AMR-WB/16000 · Call 2m22s · IMS Reg 22ms · GBR 7ms

---

## Scene 6 — Voice Degradation (Bookmark D) | 5 min

1. Click **[D · VoNR — Issues]**
2. Select the warn session

**KPI panel:**
- MOS: **2.9** (red — below 3.5 threshold)
- Packet loss: ~1.8%

> "MOS 2.9 — that's a noticeable voice quality problem. The threshold is 3.5."

**Ladder:** RTP message (seq 21) has amber/warn status.

> "NIxTrace doesn't just see the SIP signaling — it sees the RTP media plane. Jitter 18ms against a 5ms threshold, 1.8% packet loss on the GBR QFI=2 bearer. The QoS policy was correct — the bearer was established. The problem is upstream: radio congestion or uplink interference."

**Compare with Scene 5:** same procedure, same codec, fundamentally different experience — detected in one click.

---

## Scene 7 — Trigger Rules | 3 min

Click **⚡ Triggers** in the TopBar.

**Create a trigger:**
- Condition: `packet_loss > 1`
- Action: `alert`
- Label: "VoNR packet loss alert"

> "Any future session matching this condition fires an alert immediately — no polling, no dashboards to check. We can also trigger PCAP capture on specific events."

**Show the filter E (All Errors):**
1. Click **[E · All Errors]** — full cross-procedure error surface

> "This is the operator view: every failure across Registration, PDU, VoNR — in one filtered list."

---

## Scene 8 — Export | 2 min

Select any session. In the TopBar, click the **Export** menu.

**Options:**
- **↓ PNG** (in ladder toolbar) — exports the full SVG ladder as a high-res PNG for incident reports
- **PCAP** — exports raw packet hex for Wireshark import
- **HTML** — self-contained offline report
- **XSIF** — 3GPP Trace standard format for NMS integration

> "The PNG export is pixel-perfect because we render in SVG with hardcoded protocol colors — no CSS variable loss when saving."

---

## KPI Summary Slide | 2 min

| Metric | Baseline | Problem | Threshold |
|---|---|---|---|
| E2E Setup (5G SA) | **95ms** | — | — |
| Auth Round-Trip | **22ms** | 340ms (4A) | 100ms |
| PDU Setup | **33ms** | — | — |
| IMS Registration | **22ms** | — | — |
| GBR Bearer | **7ms** | — | — |
| Call Setup (INVITE→ACK) | **2.2s** | — | — |
| MOS | **4.2** | 2.9 (B2) | 3.5 |
| R-Factor | **88** | — | 70 |
| Jitter | **2ms** | 18ms (B2) | 5ms |
| Detection time | **< 3 clicks** | — | — |

---

## Customer Q&A — Prepared Answers

**Q: What's the overhead of the eBPF probes?**
> "Under 1% CPU on a production gNB-O-CU. We use kernel-level kprobe and uprobe — no packet copies, no user-space bridge. The eBPF programs run in the kernel's JIT-compiled sandbox."

**Q: Does it work with encrypted NAS?**
> "Yes. We hook at the protocol library level — `uprobe:libnghttp2` for SBI, and at the NAS layer before encryption in the UE/gNB stack. The keys are already present in the process; eBPF reads them before the crypto path."

**Q: How does it scale?**
> "The probe agents are per-NF. Each agent streams to the NIx platform via compressed JSON. The platform handles aggregation. We've tested at 10,000 concurrent sessions — the ladder diagram virtualizes rows via @tanstack/react-virtual."

**Q: Can we integrate with our existing OSS/NMS?**
> "Yes — XSIF export is the 3GPP standard for trace data. We also have a Supabase Realtime webhook that can push to any HTTPS endpoint. REST API access to the session DB is available."

**Q: Can we correlate across multiple NFs for the same subscriber?**
> "Click the underlined IMSI in the KPI panel — it filters to all sessions for that subscriber. Correlation by gNB, AMF, or time range is on the roadmap."

---

*Demo prepared for Rakuten 5G SA NIx Platform — NIxTrace v2*
