# Tire Store Tracker

Next.js + Supabase app for tracking motorcycle tire store visits, tiers,
GPS location, storefront photos, and brand-supplier distribution, with a
regional market-share dashboard.

## 1. Supabase setup
1. Create a new project at supabase.com.
2. In the SQL Editor, run `supabase/schema.sql` (creates tables, RLS
   policies, the `store-photos` storage bucket, and seeds default tiers +
   3 brands — edit the `insert into brands` list to your real brand names).
3. In Authentication → Users, manually create one user per sales rep
   (email + password). Then in the SQL editor:
   ```sql
   insert into public.sales_reps (id, full_name, role)
   values ('<user-uuid-from-auth>', 'Somchai', 'rep');
   ```
   Set `role` to `'admin'` for anyone who should be able to edit/delete
   any store.
4. Project Settings → API: copy the Project URL and `anon public` key.

## 2. Local setup
```bash
cp .env.example .env.local
# paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. Deploy to Vercel
1. Push this repo to GitHub.
2. Import it in Vercel → New Project.
3. Add the same two env vars in Vercel → Settings → Environment Variables.
4. Deploy. Every push to `main` redeploys automatically.

## Environment variables
| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |

## Project structure
```
app/
  page.tsx              → dashboard (market share, tier breakdown)
  entry/page.tsx         → sales entry form
  stores/page.tsx         → searchable/filterable store list
  stores/[id]/page.tsx    → store detail view
  login/page.tsx           → Supabase auth login
components/
  PhotoCapture.tsx        → camera/upload + client-side image compression
  GpsPicker.tsx            → auto-grab GPS + manual lat/lng entry
lib/supabase/            → browser + server Supabase clients
middleware.ts              → redirects unauthenticated users to /login
supabase/schema.sql       → full DB schema, RLS policies, storage bucket
```

## Adding a new brand
No code change needed — just:
```sql
insert into public.brands (name) values ('New Brand');
```
It will appear in the entry form and dashboard automatically.

## Notes on design decisions
See `PROMPT.md` for the corrected spec and why brands are a normalized
table instead of fixed `brand_a/b/c` columns, how market share % is
calculated, and the RLS/auth model.
