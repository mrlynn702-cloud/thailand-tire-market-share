'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type StoreRow = { id: string; province: string | null; tiers: { label: string } | null };
type SalesRow = { store_id: string; category: 'tire' | 'tube'; quantity_sold: number };
type ShareRow = { store_id: string; category: 'tire' | 'tube'; percentage: number; brands: { name: string } | null };

export default function DashboardPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [provinceFilter, setProvinceFilter] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('stores').select('id, province, tiers(label)'),
      supabase.from('store_category_sales').select('store_id, category, quantity_sold'),
      supabase.from('store_brand_shares').select('store_id, category, percentage, brands(name)'),
    ]).then(([storesRes, salesRes, sharesRes]) => {
      if (storesRes.data) setStores(storesRes.data as unknown as StoreRow[]);
      if (salesRes.data) setSales(salesRes.data as unknown as SalesRow[]);
      if (sharesRes.data) setShares(sharesRes.data as unknown as ShareRow[]);
      setLoading(false);
    });
  }, []);

  const provinces = useMemo(
    () => Array.from(new Set(stores.map((s) => s.province).filter(Boolean))) as string[],
    [stores]
  );

  const scopedStoreIds = useMemo(() => {
    const filtered = provinceFilter ? stores.filter((s) => s.province === provinceFilter) : stores;
    return new Set(filtered.map((s) => s.id));
  }, [stores, provinceFilter]);

  const totalStores = scopedStoreIds.size;

  // total units sold per category, within scope
  const totalUnits = useMemo(() => {
    const totals = { tire: 0, tube: 0 };
    for (const s of sales) {
      if (!scopedStoreIds.has(s.store_id)) continue;
      totals[s.category] += s.quantity_sold;
    }
    return totals;
  }, [sales, scopedStoreIds]);

  // volume-weighted brand share: for each store's category, brand's units = store_qty * (pct/100),
  // summed across stores, then divided by total units sold in that category. Falls back gracefully
  // when a store reports % without a quantity — those are simply excluded from the weighted total.
  function volumeWeightedShare(category: 'tire' | 'tube') {
    const qtyByStore: Record<string, number> = {};
    for (const s of sales) {
      if (s.category === category && scopedStoreIds.has(s.store_id)) qtyByStore[s.store_id] = s.quantity_sold;
    }
    const unitsByBrand: Record<string, number> = {};
    for (const sh of shares) {
      if (sh.category !== category || !sh.brands?.name || !scopedStoreIds.has(sh.store_id)) continue;
      const qty = qtyByStore[sh.store_id];
      if (!qty) continue;
      const units = qty * (sh.percentage / 100);
      unitsByBrand[sh.brands.name] = (unitsByBrand[sh.brands.name] ?? 0) + units;
    }
    const denom = Object.values(unitsByBrand).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(unitsByBrand)
      .map(([name, units]) => ({ name, pct: Math.round((units / denom) * 1000) / 10 }))
      .sort((a, b) => b.pct - a.pct);
  }

  const tireShare = useMemo(() => volumeWeightedShare('tire'), [sales, shares, scopedStoreIds]);
  const tubeShare = useMemo(() => volumeWeightedShare('tube'), [sales, shares, scopedStoreIds]);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Overview — {totalStores} stores</h1>
        <select
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">ยอดขายยางนอกรวม (Tire)</p>
          <p className="text-2xl font-semibold">{totalUnits.tire.toLocaleString()} เส้น</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">ยอดขายยางในรวม (Tube)</p>
          <p className="text-2xl font-semibold">{totalUnits.tube.toLocaleString()} เส้น</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ShareChart title="🛞 ยางนอก — Brand share (by volume)" data={tireShare} />
        <ShareChart title="⭕ ยางใน — Brand share (by volume)" data={tubeShare} />
      </div>

      <p className="text-xs text-gray-400 mt-4">
        สัดส่วน % คำนวณแบบถ่วงน้ำหนักตามยอดขายจริง: (ยอดขายร้าน × %แบรนด์ของร้าน) รวมทุกร้าน ÷
        ยอดขายรวมทั้งหมดในหมวดนั้น — ร้านที่กรอก % แต่ไม่กรอกยอดขายจะไม่ถูกนับในกราฟนี้
      </p>
    </div>
  );
}

function ShareChart({ title, data }: { title: string; data: { name: string; pct: number }[] }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-600 mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400">No data yet.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" unit="%" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
              <Bar dataKey="pct" fill="#111827" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
