import { makeToken } from '@/lib/server';
export async function POST(req) {
  const { user, password } = await req.json();
  const ok = (user === 'owner' && password === process.env.OWNER_PASSWORD) ||
             (user === 'supervisor' && password === process.env.SUPERVISOR_PASSWORD);
  if (!ok || !password) return Response.json({ error: 'Wrong name or password' }, { status: 401 });
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', `s=${makeToken(user)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return res;
}
