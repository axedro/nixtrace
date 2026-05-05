import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — running via tsx which resolves this path correctly
import { generateSession } from '../src/data/sessionGenerator';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key || url.includes('xxxxxxxxxxxx')) {
  console.error('[seed] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('[NIxTrace Seeder] Connected — inserting sessions (Ctrl+C to stop)');
  let count = 0;

  while (true) {
    const session = generateSession();
    const { error } = await supabase.from('sessions').insert({
      id:            session.id,
      timestamp:     session.timestamp,
      imsi:          session.imsi,
      msisdn:        session.msisdn,
      procedure:     session.procedure,
      primary_iface: session.primary_iface,
      slice:         session.slice,
      duration_ms:   session.duration_ms,
      status:        session.status,
      gnb:           session.gnb,
      amf:           session.amf,
      smf:           session.smf,
      upf:           session.upf,
      nfs:           session.nfs,
      messages:      session.messages,
      kpis:          session.kpis,
    });

    count++;
    if (error) {
      console.error(`[${count}] ERR  ${error.message}`);
    } else {
      const pad = (s: string, n: number) => s.padEnd(n);
      console.log(
        `[${String(count).padStart(4)}] ${pad(session.status.toUpperCase(), 4)} ` +
        `${pad(session.procedure, 32)} ${pad(session.slice, 6)} ` +
        `${session.duration_ms}ms`
      );
    }

    const delay = 800 + Math.random() * 700;
    await new Promise((r) => setTimeout(r, delay));
  }
}

run().catch((err) => { console.error('[seed] fatal:', err); process.exit(1); });
