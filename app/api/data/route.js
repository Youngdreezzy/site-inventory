import { getRole, loadAll, compute } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const role = getRole();
  if (!role) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const d = await loadAll();
  return Response.json({ role, ...d, balances: compute(d.entries, d.voids) });
}
