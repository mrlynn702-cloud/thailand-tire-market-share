'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Row = {
  id: string;
  store_name: string;
  location: string;
  province: string | null;
  created_at: string;
  tiers: { label: string } | null;
};

type Tier = { id: string; label: string };

export default function StoresPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('tiers').select('id, label').order('sort_order').then(({ data }) => {
      if (data) setTiers(data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from('stores')
      .select('id, store_name, location, province, created_at, tiers(label)')
      .order('created_at', { ascending: !sortDesc });

    if (tierFilter) query = query.eq('tier_id', tierFilter);
    if (search) query = query.ilike('store_name', `%${search}%`);

    query.then(({ data }) => {
      if (data) setRows(data as unknown as Row[]);
      setLoading(false);
    });
  }, [search, tierFilter, sortDesc]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input
          placeholder="Search store name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1 min-w-[180px]"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All tiers</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={() => setSortDesc((s) => !s)}
          className="text-sm border rounded px-3 py-2 bg-white"
        >
          {sortDesc ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">Store</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Province</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/stores/${r.id}`} className="text-blue-600 hover:underline">
                    {r.store_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600">{r.location}</td>
                <td className="px-3 py-2 text-gray-600">{r.province ?? '—'}</td>
                <td className="px-3 py-2">{r.tiers?.label ?? '—'}</td>
                <td className="px-3 py-2 text-gray-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No stores found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
