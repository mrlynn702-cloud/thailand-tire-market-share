-- ============================================================
-- Tire Store Tracker — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- sales_reps (allow-list / profile for auth users) ----------
create table if not exists public.sales_reps (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'rep' check (role in ('rep', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------- brands (normalized, add new brands anytime) ----------
create table if not exists public.brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.brands (name) values
  ('Deestone'), ('Bluhorse'), ('Brand C')
on conflict (name) do nothing;

-- ---------- tiers (lookup, keeps tier labels consistent) ----------
create table if not exists public.tiers (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,        -- e.g. 'A', 'B', 'C'
  label text not null,              -- e.g. 'Tier A - High Volume'
  sort_order int not null default 0
);

insert into public.tiers (code, label, sort_order) values
  ('A', 'Tier A - High Volume', 1),
  ('B', 'Tier B - Medium Volume', 2),
  ('C', 'Tier C - Low Volume', 3)
on conflict (code) do nothing;

-- ---------- stores ----------
create table if not exists public.stores (
  id uuid primary key default uuid_generate_v4(),
  store_name text not null,
  location text not null,           -- freetext address
  province text,                    -- used for regional dashboard grouping
  latitude double precision,
  longitude double precision,
  tier_id uuid references public.tiers(id),
  store_photo_url text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stores_tier on public.stores(tier_id);
create index if not exists idx_stores_province on public.stores(province);
create index if not exists idx_stores_created_at on public.stores(created_at desc);

-- ---------- store_brands (many-to-many: which brands supply this store) ----------
create table if not exists public.store_brands (
  store_id uuid references public.stores(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  is_primary_supplier boolean not null default false,
  primary key (store_id, brand_id)
);

create index if not exists idx_store_brands_brand on public.store_brands(brand_id);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stores_updated_at on public.stores;
create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.stores enable row level security;
alter table public.store_brands enable row level security;
alter table public.brands enable row level security;
alter table public.tiers enable row level security;
alter table public.sales_reps enable row level security;

-- any authenticated rep can read everything
create policy "read stores" on public.stores for select to authenticated using (true);
create policy "read store_brands" on public.store_brands for select to authenticated using (true);
create policy "read brands" on public.brands for select to authenticated using (true);
create policy "read tiers" on public.tiers for select to authenticated using (true);
create policy "read own rep row" on public.sales_reps for select to authenticated using (true);

-- any authenticated rep can insert stores (created_by must be their own uid)
create policy "insert own stores" on public.stores for insert to authenticated
  with check (created_by = auth.uid());

create policy "insert store_brands" on public.store_brands for insert to authenticated
  with check (
    exists (select 1 from public.stores s where s.id = store_id and s.created_by = auth.uid())
  );

-- reps can update their own store entries; admins can update any
create policy "update own or admin" on public.stores for update to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.sales_reps r where r.id = auth.uid() and r.role = 'admin')
  );

-- only admins can delete
create policy "delete admin only" on public.stores for delete to authenticated
  using (exists (select 1 from public.sales_reps r where r.id = auth.uid() and r.role = 'admin'));

-- ============================================================
-- Storage bucket for store photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('store-photos', 'store-photos', true)
on conflict (id) do nothing;

create policy "authenticated upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-photos');

create policy "public read photos" on storage.objects for select
  using (bucket_id = 'store-photos');
