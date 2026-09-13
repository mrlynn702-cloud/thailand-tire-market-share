import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: store } = await supabase
    .from('stores')
    .select('*, tiers(label), store_brands(brands(name))')
    .eq('id', params.id)
    .single();

  if (!store) notFound();

  const brandNames = (store.store_brands ?? [])
    .map((sb: any) => sb.brands?.name)
    .filter(Boolean);

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

      <div className="bg-white border rounded-lg p-5 space-y-3 text-sm">
        <Row label="Location" value={store.location} />
        <Row label="Province" value={store.province ?? '—'} />
        <Row
          label="GPS"
          value={
            store.latitude && store.longitude
              ? `${store.latitude}, ${store.longitude}`
              : '—'
          }
        />
        <Row label="Tier" value={store.tiers?.label ?? '—'} />
        <Row label="Brand suppliers" value={brandNames.length ? brandNames.join(', ') : '—'} />
        <Row label="Notes" value={store.notes ?? '—'} />
        <Row label="Added" value={new Date(store.created_at).toLocaleString()} />
      </div>

      {store.latitude && store.longitude && (
        <a
          className="inline-block mt-3 text-sm text-blue-600 hover:underline"
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
