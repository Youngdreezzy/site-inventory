import crypto from 'crypto';
import { redis, getRole, loadAll, compute } from '@/lib/server';
export const dynamic = 'force-dynamic';
const err = (m, s = 400) => Response.json({ error: m }, { status: s });

export async function POST(req) {
  const role = getRole();
  if (!role) return err('Not signed in', 401);
  const b = await req.json();
  const { entries, voids, sites, materials } = await loadAll();
  const name = String(b.name || '').trim();

  if (b.action === 'site' || b.action === 'material') {
    if (!name) return err('Enter a name');
    if (b.action === 'site') {
      if (sites.some((s) => s.toLowerCase() === name.toLowerCase())) return err('That site already exists');
      await redis.sadd('sites', name);
    } else {
      if (Object.keys(materials).some((m) => m.toLowerCase() === name.toLowerCase())) return err('That material already exists');
      if (!String(b.unit || '').trim()) return err('Enter a unit, e.g. bags');
      await redis.hset('materials', { [name]: String(b.unit).trim() });
    }
    return Response.json({ ok: true });
  }

  if (b.action === 'void') {
    if (role !== 'owner') return err('Only the owner can void entries', 403);
    const e = entries.find((x) => x.id === b.id);
    if (!e || voids[b.id]) return err('Entry not found or already voided');
    if (!String(b.reason || '').trim()) return err('A reason is required');
    const test = { ...voids, [b.id]: true };
    if (Object.values(compute(entries, test)).some((x) => x.qty < -1e-9))
      return err('Voiding this would leave a site with negative stock. Void the later transfers first.');
    await redis.hset('voids', { [b.id]: { by: role, at: new Date().toISOString(), reason: String(b.reason).trim() } });
    return Response.json({ ok: true });
  }

  if (b.action === 'entry') {
    const qty = Number(b.qty);
    if (!['delivery', 'transfer', 'used'].includes(b.type)) return err('Choose a movement type');
    if (!materials[b.material]) return err('Choose a material');
    if (!(qty > 0)) return err('Quantity must be more than zero');
    const e = { id: crypto.randomUUID(), type: b.type, material: b.material, unit: materials[b.material], qty,
                note: String(b.note || '').trim(), by: role, at: new Date().toISOString() };
    const bal = compute(entries, voids);
    const from = b.type === 'transfer' ? b.from : b.site;
    if (b.type === 'delivery') {
      if (!sites.includes(b.site)) return err('Choose a site');
      const p = Number(b.unitPrice);
      if (!(p >= 0) || b.unitPrice === '' || b.unitPrice == null) return err('Enter the unit price');
      Object.assign(e, { site: b.site, unitPrice: p });
    } else {
      if (!sites.includes(from)) return err('Choose a site');
      const x = bal[from + '|' + b.material] || { qty: 0, value: 0 };
      if (qty > x.qty + 1e-9) return err(`${from} only has ${x.qty} ${e.unit} of ${b.material}`);
      const avg = x.qty > 0 ? x.value / x.qty : 0;
      if (b.type === 'transfer') {
        if (!sites.includes(b.to) || b.to === from) return err('Choose a different site to transfer to');
        Object.assign(e, { from, to: b.to, unitPrice: avg });
      } else Object.assign(e, { site: from, unitPrice: avg });
    }
    await redis.rpush('entries', e);
    return Response.json({ ok: true });
  }
  return err('Unknown action');
}
