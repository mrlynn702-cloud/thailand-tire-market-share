import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: store } = await supabase
    .from('stores')
    .select('*, tiers(label)')
    .eq('id', params.id)
    .single();

  if (!store) notFound();

  const [{ data: sales }, { data: shares }] = await Promise.all([
    supabase.from('store_category_sales').select('category, quantity_sold').eq('store_id', params.id),
    supabase
      .from('store_brand_shares')
      .select('category, percentage, brands(name)')
      .eq('store_id', params.id),
  ]);

  const salesByCategory: Record<string, number> = {};
  (sales ?? []).forEach((s: any) => { salesByCategory[s.category] = s.quantity_sold; });

  const sharesByCategory: Record<string, { name: string; pct: number }[]> = { tire: [], tube: [] };
  (shares ?? []).forEach((s: any) => {
    if (!s.brands?.name) return;
    sharesByCategory[s.category]?.push({ name: s.brands.name, pct: s.percentage });
  });

  return (
    <div className="max-w-2xl">
      <a href="/stores" className="text-sm text-blue-600 hover:underline">← Back to list</a>
      <h1 className="text-xl font-semibold mt-2 mb-4">{store.store_name}</h1>

      {store.store_photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.store_photo_url}
          alt={store.store_name}
          className="w-full max-h-80 object-cover rounded-lg border mb-4"
        />
      )}

      <div className="bg-white border rounded-lg p-5 space-y-3 text-sm mb-4">
        <Row label="Location" value={store.location} />
        <Row label="Province" value={store.province ?? '—'} />
        <Row
          label="GPS"
          value={store.latitude && store.longitude ? `${store.latitude}, ${store.longitude}` : '—'}
        />
        <Row label="Tier" value={store.tiers?.label ?? '—'} />
        <Row label="Notes" value={store.notes ?? '—'} />
        <Row label="Added" value={new Date(store.created_at).toLocaleString()} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <CategoryCard title="🛞 ยางนอก (Tire)" quantity={salesByCategory.tire} shares={sharesByCategory.tire} />
        <CategoryCard title="⭕ ยางใน (Tube)" quantity={salesByCategory.tube} shares={sharesByCategory.tube} />
      </div>

      {store.latitude && store.longitude && (
        <a
          className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          target="_blank"
          href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
        >
          Open in Google Maps →
        </a>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b last:border-0 pb-2 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function CategoryCard({
  title,
  quantity,
  shares,
}: {
  title: string;
  quantity?: number;
  shares: { name: string; pct: number }[];
}) {
  return (
    <div className="bg-white border rounded-lg p-4 text-sm">
      <h2 className="font-medium mb-2">{title}</h2>
      <p className="text-gray-500 mb-3">
        ยอดขาย: <span className="font-medium text-gray-900">{quantity ?? '—'}</span> เส้น
      </p>
      {shares.length === 0 ? (
        <p className="text-gray-400">ไม่มีข้อมูลแบรนด์</p>
      ) : (
        <ul className="space-y-1">
          {shares.map((s) => (
            <li key={s.name} className="flex justify-between">
              <span>{s.name}</span>
              <span className="font-medium">{s.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
