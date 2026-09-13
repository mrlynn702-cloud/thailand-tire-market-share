'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PhotoCapture from '@/components/PhotoCapture';
import GpsPicker from '@/components/GpsPicker';

type Tier = { id: string; code: string; label: string };
type Brand = { id: string; name: string };

export default function EntryPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');
  const [province, setProvince] = useState('');
  const [tierId, setTierId] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('tiers').select('id, code, label').order('sort_order').then(({ data }) => {
      if (data) setTiers(data);
    });
    supabase.from('brands').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setBrands(data);
    });
  }, []);

  function toggleBrand(id: string) {
    setSelectedBrands((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');

      // 1. upload photo (if any) first
      let photoUrl: string | null = null;
      if (photoFile) {
        const path = `${user.id}/${Date.now()}-${photoFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('store-photos')
          .upload(path, photoFile, { cacheControl: '3600', upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: pub } = supabase.storage.from('store-photos').getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      // 2. insert store row
      const { data: store, error: insertErr } = await supabase
        .from('stores')
        .insert({
          store_name: storeName,
          location,
          province: province || null,
          latitude: lat,
          longitude: lng,
          tier_id: tierId || null,
          store_photo_url: photoUrl,
          notes: notes || null,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // 3. link brand suppliers
      if (selectedBrands.length > 0 && store) {
        const rows = selectedBrands.map((brand_id) => ({ store_id: store.id, brand_id }));
        const { error: linkErr } = await supabase.from('store_brands').insert(rows);
        if (linkErr) throw linkErr;
      }

      router.push(`/stores/${store!.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold mb-4">New store entry</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-lg border">
        <div>
          <label className="text-sm text-gray-600 block mb-1">Store name</label>
          <input
            required
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1">Address / location</label>
          <input
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1">Province (for regional dashboard)</label>
          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <GpsPicker latitude={lat} longitude={lng} onChange={(a, b) => { setLat(a); setLng(b); }} />

        <PhotoCapture onFileReady={(file) => setPhotoFile(file)} />

        <div>
          <label className="text-sm text-gray-600 block mb-1">Tier</label>
          <select
            required
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select tier…</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-2">Brand suppliers (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {brands.map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => toggleBrand(b.id)}
                className={`text-sm rounded-full px-3 py-1.5 border ${
                  selectedBrands.includes(b.id)
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button disabled={saving} className="bg-black text-white rounded px-4 py-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save store'}
        </button>
      </form>
    </div>
  );
}
