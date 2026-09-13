'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type StoreBrandRow = {
  store_id: string;
  brands: { name: string } | null;
};

type StoreRow = {
  id: string;
  province: string | null;
  tiers: { label: string } | null;
};

export default function DashboardPage() {
  const supabase = createClient();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [links, setLinks] = useState<StoreBrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [provinceFilter, setProvinceFilter] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('stores').select('id, province, tiers(label)'),
      supabase.from('store_brands').select('store_id, brands(name)'),
    ]).then(([storesRes, linksRes]) => {
      if (storesRes.data) setStores(storesRes.data as unknown as StoreRow[]);
      if (linksRes.data) setLinks(linksRes.data as unknown as StoreBrandRow[]);
      setLoading(false);
    });
  }, []);

  const provinces = useMemo(
    () => Array.from(new Set(stores.map((s) => s.province).filter(Boolean))) as string[],
    [stores]
  );

  const filteredStoreIds = useMemo(() => {
    const filtered = provinceFilter ? stores.filter((s) => s.province === provinceFilter) : stores;
    return new Set(filtered.map((s) => s.id));
  }, [stores, provinceFilter]);

  const totalStores = filteredStoreIds.size;

  // market share % by brand = stores carrying brand X / total stores in scope
  const brandShare = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const link of links) {
      if (!link.brands?.name) continue;
      if (!filteredStoreIds.has(link.store_id)) continue;
      counts[link.brands.name] = (counts[link.brands.name] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        pct: totalStores ? Math.round((count / totalStores) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [links, filteredStoreIds, totalStores]);

  // tier breakdown within scope
  const tierBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stores) {
      if (!filteredStoreIds.has(s.id)) continue;
      const label = s.tiers?.label ?? 'Unassigned';
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [stores, filteredStoreIds]);

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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Brand market share (% of stores)</h2>
          {brandShare.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandShare} layout="vertical" margin={{ left: 20 }}>
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

        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Stores by tier</h2>
          {tierBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Market share = (stores that list the brand as a supplier) ÷ (total stores in the current
        filter) × 100. A store can carry multiple brands, so shares may not sum to 100%.
      </p>
    </div>
  );
}
