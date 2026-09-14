'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PhotoCapture from '@/components/PhotoCapture';
import GpsPicker from '@/components/GpsPicker';

type Tier = { id: string; code: string; label: string };
type Brand = { id: string; name: string };
type Category = 'tire' | 'tube';

// per-category state: how many units sold, and % share per selected brand
type CategoryState = {
  quantitySold: string; // keep as string for controlled input, parse on submit
  shares: Record<string, string>; // brand_id -> percentage string
};

const emptyCategoryState = (): CategoryState => ({ quantitySold: '', shares: {} });

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const [tire, setTire] = useState<CategoryState>(emptyCategoryState());
  const [tube, setTube] = useState<CategoryState>(emptyCategoryState());

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

  function toggleBrandInCategory(cat: Category, brandId: string) {
    const setter = cat === 'tire' ? setTire : setTube;
    setter((prev) => {
      const next = { ...prev.shares };
      if (brandId in next) {
        delete next[brandId];
      } else {
        next[brandId] = '';
      }
      return { ...prev, shares: next };
    });
  }

  function setBrandPercentage(cat: Category, brandId: string, value: string) {
    const setter = cat === 'tire' ? setTire : setTube;
    setter((prev) => ({ ...prev, shares: { ...prev.shares, [brandId]: value } }));
  }

  function totalPercent(cat: CategoryState) {
    return Object.values(cat.shares).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
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
      const storeId = store!.id;

      // 3. units sold per category (only insert if a quantity was entered)
      const categorySalesRows = (['tire', 'tube'] as Category[])
        .map((cat) => ({ cat, state: cat === 'tire' ? tire : tube }))
        .filter(({ state }) => state.quantitySold !== '')
        .map(({ cat, state }) => ({
          store_id: storeId,
          category: cat,
          quantity_sold: parseInt(state.quantitySold, 10) || 0,
        }));
      if (categorySalesRows.length > 0) {
        const { error: salesErr } = await supabase.from('store_category_sales').insert(categorySalesRows);
        if (salesErr) throw salesErr;
      }

      // 4. brand % shares per category (only rows where a % was actually entered)
      const shareRows = (['tire', 'tube'] as Category[]).flatMap((cat) => {
        const state = cat === 'tire' ? tire : tube;
        return Object.entries(state.shares)
          .filter(([, pct]) => pct !== '')
          .map(([brandId, pct]) => ({
            store_id: storeId,
            brand_id: brandId,
            category: cat,
            percentage: parseFloat(pct) || 0,
          }));
      });
      if (shareRows.length > 0) {
        const { error: shareErr } = await supabase.from('store_brand_shares').insert(shareRows);
        if (shareErr) throw shareErr;
      }

      router.push(`/stores/${storeId}`);
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

        <CategorySection
          title="🛞 ยางนอก (Tire)"
          category="tire"
          state={tire}
          brands={brands}
          onQuantityChange={(v) => setTire((p) => ({ ...p, quantitySold: v }))}
          onToggleBrand={(id) => toggleBrandInCategory('tire', id)}
          onPercentChange={(id, v) => setBrandPercentage('tire', id, v)}
          total={totalPercent(tire)}
        />

        <CategorySection
          title="⭕ ยางใน (Tube)"
          category="tube"
          state={tube}
          brands={brands}
          onQuantityChange={(v) => setTube((p) => ({ ...p, quantitySold: v }))}
          onToggleBrand={(id) => toggleBrandInCategory('tube', id)}
          onPercentChange={(id, v) => setBrandPercentage('tube', id, v)}
          total={totalPercent(tube)}
        />

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

function CategorySection({
  title,
  state,
  brands,
  onQuantityChange,
  onToggleBrand,
  onPercentChange,
  total,
}: {
  title: string;
  category: Category;
  state: CategoryState;
  brands: Brand[];
  onQuantityChange: (v: string) => void;
  onToggleBrand: (brandId: string) => void;
  onPercentChange: (brandId: string, v: string) => void;
  total: number;
}) {
  const selectedIds = Object.keys(state.shares);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h2 className="font-medium mb-3">{title}</h2>

      <div className="mb-3">
        <label className="text-sm text-gray-600 block mb-1">ยอดขาย (เส้น)</label>
        <input
          type="number"
          min={0}
          placeholder="เช่น 120"
          value={state.quantitySold}
          onChange={(e) => onQuantityChange(e.target.value)}
          className="w-full sm:w-48 border rounded px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm text-gray-600 block mb-2">แบรนด์ที่ขาย และสัดส่วน %</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {brands.map((b) => (
            <button
              type="button"
              key={b.id}
              onClick={() => onToggleBrand(b.id)}
              className={`text-sm rounded-full px-3 py-1.5 border ${
                selectedIds.includes(b.id)
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <div className="space-y-2">
            {selectedIds.map((brandId) => {
              const brand = brands.find((b) => b.id === brandId);
              return (
                <div key={brandId} className="flex items-center gap-2">
                  <span className="text-sm w-28 truncate">{brand?.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="%"
                    value={state.shares[brandId]}
                    onChange={(e) => onPercentChange(brandId, e.target.value)}
                    className="w-24 border rounded px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              );
            })}
            <p className={`text-xs ${total > 100 ? 'text-red-600' : 'text-gray-500'}`}>
              รวม {total.toFixed(1)}% {total > 100 && '(เกิน 100% — เช็คตัวเลขอีกที)'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
