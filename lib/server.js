import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const sign = (v) => crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(v).digest('hex');
export const makeToken = (role) => role + '.' + sign(role);
export function getRole() {
  const t = cookies().get('s')?.value;
  if (!t) return null;
  const [r, s] = t.split('.');
  return ['owner', 'supervisor'].includes(r) && s === sign(r) ? r : null;
}

export async function loadAll() {
  const [entries, voids, sites, materials] = await Promise.all([
    redis.lrange('entries', 0, -1), redis.hgetall('voids'), redis.smembers('sites'), redis.hgetall('materials'),
  ]);
  return { entries: entries || [], voids: voids || {}, sites: (sites || []).sort(), materials: materials || {} };
}

// Balance per "site|material": quantity and value (transfers/usage leave at the site's average cost)
export function compute(entries, voids) {
  const b = {};
  for (const e of entries) {
    if (voids[e.id]) continue;
    const slot = (s) => (b[s + '|' + e.material] ??= { qty: 0, value: 0 });
    const take = (s) => { const x = slot(s); const avg = x.qty > 0 ? x.value / x.qty : 0; x.qty -= e.qty; x.value -= avg * e.qty; return avg; };
    const put = (s, v) => { const x = slot(s); x.qty += e.qty; x.value += v; };
    if (e.type === 'delivery') put(e.site, e.qty * e.unitPrice);
    else if (e.type === 'transfer') put(e.to, take(e.from) * e.qty);
    else take(e.site);
  }
  return b;
}
