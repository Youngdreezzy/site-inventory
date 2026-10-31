'use client';
import { useState, useEffect, useCallback } from 'react';

const money = (v) => '₦' + Math.round(v).toLocaleString('en-NG');
const num = (v) => Math.round(v * 100) / 100;
const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const TYPES = { delivery: 'Delivery', transfer: 'Transfer', used: 'Used / wasted' };

function Login({ onDone }) {
  const [user, setUser] = useState('owner');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const go = async () => { const r = await post('/api/login', { user, password }); r.error ? setError(r.error) : onDone(); };
  return (
    <div className="wrap"><header><h1>Site Inventory</h1></header>
      <div className="card">
        <label>Who is signing in?</label>
        <select value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="owner">Owner</option><option value="supervisor">Supervisor</option>
        </select>
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        {error && <p className="err">{error}</p>}
        <p><button className="go" onClick={go}>Sign in</button></p>
      </div>
    </div>
  );
}

function Balances({ d }) {
  const rows = Object.entries(d.balances).filter(([, v]) => Math.abs(v.qty) > 1e-9);
  if (!d.sites.length) return <div className="card">No sites yet. Add your sites under Setup.</div>;
  return d.sites.map((site) => {
    const mine = rows.filter(([k]) => k.startsWith(site + '|'));
    const total = mine.reduce((a, [, v]) => a + v.value, 0);
    return (
      <div className="card" key={site}>
        <h2>{site} <span className="mute">· {money(total)}</span></h2>
        {mine.length === 0 ? <p className="mute">Nothing on site yet.</p> : (
          <table><tbody>
            {mine.map(([k, v]) => { const m = k.split('|')[1]; return (
              <tr key={k}><td>{m}</td><td className="r">{num(v.qty)} {d.materials[m]}</td><td className="r">{money(v.value)}</td></tr>); })}
          </tbody></table>
        )}
      </div>
    );
  });
}

function Entry({ d, reload }) {
  const [f, setF] = useState({ type: 'delivery' });
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const r = await post('/api/act', { action: 'entry', ...f, from: f.site });
    if (r.error) return setMsg({ bad: true, t: r.error });
    setMsg({ t: 'Saved' }); setF({ type: f.type, site: f.site, material: f.material }); reload();
  };
  const mats = Object.keys(d.materials);
  const price = f.type === 'delivery';
  const total = price ? (Number(f.qty) || 0) * (Number(f.unitPrice) || 0) : 0;
  return (
    <div className="card">
      <div className="row">{Object.entries(TYPES).map(([k, t]) =>
        <button key={k} className={f.type === k ? 'on' : ''} onClick={() => { setF({ type: k }); setMsg(null); }}>{t}</button>)}</div>
      <label>{f.type === 'transfer' ? 'From site' : 'Site'}</label>
      <select value={f.site || ''} onChange={set('site')}><option value="">Choose…</option>{d.sites.map((s) => <option key={s}>{s}</option>)}</select>
      {f.type === 'transfer' && <>
        <label>To site</label>
        <select value={f.to || ''} onChange={set('to')}><option value="">Choose…</option>{d.sites.filter((s) => s !== f.site).map((s) => <option key={s}>{s}</option>)}</select></>}
      <label>Material</label>
      <select value={f.material || ''} onChange={set('material')}><option value="">Choose…</option>{mats.map((m) => <option key={m} value={m}>{m} ({d.materials[m]})</option>)}</select>
      <label>Quantity</label>
      <input type="number" inputMode="decimal" value={f.qty || ''} onChange={set('qty')} />
      {price && <><label>Unit price (₦)</label>
        <input type="number" inputMode="decimal" value={f.unitPrice || ''} onChange={set('unitPrice')} />
        <p className="mute">Total: {money(total)}</p></>}
      <label>Note (supplier, invoice no., reason)</label>
      <input value={f.note || ''} onChange={set('note')} />
      {msg && <p className={msg.bad ? 'err' : 'ok'}>{msg.t}</p>}
      <p><button className="go" onClick={save}>Save {TYPES[f.type].toLowerCase()}</button></p>
    </div>
  );
}

function History({ d, reload }) {
  const [err, setErr] = useState('');
  const doVoid = async (id) => {
    const reason = prompt('Reason for voiding this entry?');
    if (!reason) return;
    const r = await post('/api/act', { action: 'void', id, reason });
    r.error ? setErr(r.error) : (setErr(''), reload());
  };
  const list = [...d.entries].reverse();
  if (!list.length) return <div className="card">No entries yet. Record the first delivery under New entry.</div>;
  return (
    <div className="card">{err && <p className="err">{err}</p>}
      <table><tbody>{list.map((e) => { const v = d.voids[e.id]; return (
        <tr key={e.id}><td className={v ? 'void' : ''}>
          <b>{TYPES[e.type]}</b> · {num(e.qty)} {e.unit} {e.material}<br />
          <span className="mute">{e.type === 'transfer' ? `${e.from} → ${e.to}` : e.site} · {new Date(e.at).toLocaleDateString('en-NG')} · {e.by}{e.note ? ` · ${e.note}` : ''}</span>
          {v && <><br /><span className="err">Voided by {v.by}: {v.reason}</span></>}
        </td>
        <td className="r">{money(e.qty * e.unitPrice)}{d.role === 'owner' && !v && <><br /><button className="link" onClick={() => doVoid(e.id)}>Void</button></>}</td></tr>); })}
      </tbody></table>
    </div>
  );
}

function Setup({ d, reload }) {
  const [s, setS] = useState(''); const [m, setM] = useState(''); const [u, setU] = useState(''); const [err, setErr] = useState('');
  const add = async (body, clear) => { const r = await post('/api/act', body); r.error ? setErr(r.error) : (setErr(''), clear(), reload()); };
  return (
    <>
      <div className="card"><h2>Sites</h2>
        <p className="mute">{d.sites.join(', ') || 'None yet'}</p>
        <div className="row"><input placeholder="New site name" value={s} onChange={(e) => setS(e.target.value)} />
          <button onClick={() => add({ action: 'site', name: s }, () => setS(''))}>Add site</button></div></div>
      <div className="card"><h2>Materials</h2>
        <p className="mute">{Object.entries(d.materials).map(([k, v]) => `${k} (${v})`).join(', ') || 'None yet'}</p>
        <div className="row"><input placeholder="Material, e.g. Cement" value={m} onChange={(e) => setM(e.target.value)} />
          <input placeholder="Unit, e.g. bags" value={u} onChange={(e) => setU(e.target.value)} /></div>
        <p><button onClick={() => add({ action: 'material', name: m, unit: u }, () => { setM(''); setU(''); })}>Add material</button></p>
        {err && <p className="err">{err}</p>}</div>
    </>
  );
}

export default function Home() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('bal');
  const reload = useCallback(async () => { const r = await fetch('/api/data'); setD(r.ok ? await r.json() : { role: null }); }, []);
  useEffect(() => { reload(); }, [reload]);
  if (!d) return <p className="pad">Loading…</p>;
  if (!d.role) return <Login onDone={reload} />;
  const tabs = { bal: 'Balances', entry: 'New entry', hist: 'History', setup: 'Setup' };
  return (
    <div className="wrap">
      <header><h1>Site Inventory</h1>
        <span className="mute">{d.role} · <button className="link" onClick={async () => { await post('/api/logout'); reload(); }}>Sign out</button></span></header>
      <nav>{Object.entries(tabs).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}
        <a className="btn" href="/api/export">Export Excel</a></nav>
      {tab === 'bal' && <Balances d={d} />}
      {tab === 'entry' && <Entry d={d} reload={reload} />}
      {tab === 'hist' && <History d={d} reload={reload} />}
      {tab === 'setup' && <Setup d={d} reload={reload} />}
    </div>
  );
}
