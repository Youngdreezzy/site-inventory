import * as XLSX from 'xlsx';
import { getRole, loadAll, compute } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!getRole()) return new Response('Not signed in', { status: 401 });
  const { entries, voids, materials } = await loadAll();
  const rows = entries.map((e) => ({
    Date: e.at.slice(0, 10), Type: e.type, Material: e.material,
    'From / Site': e.from || e.site, To: e.to || '', Qty: e.qty, Unit: e.unit,
    'Unit price (₦)': Math.round(e.unitPrice * 100) / 100, 'Total (₦)': Math.round(e.qty * e.unitPrice),
    Note: e.note, 'Entered by': e.by,
    Status: voids[e.id] ? `VOID: ${voids[e.id].reason}` : 'OK',
  }));
  const bal = Object.entries(compute(entries, voids)).filter(([, v]) => Math.abs(v.qty) > 1e-9).map(([k, v]) => {
    const [site, material] = k.split('|');
    return { Site: site, Material: material, Unit: materials[material], Balance: v.qty, 'Value (₦)': Math.round(v.value) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bal), 'Balances');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'All entries');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buf, { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="site-inventory-${new Date().toISOString().slice(0, 10)}.xlsx"` } });
}
