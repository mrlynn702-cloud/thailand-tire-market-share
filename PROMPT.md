# Tire Store Tracker — Revised Build Spec

## Role & Objective
Build a production-ready web app for tracking motorcycle tire store data,
store tiers, and brand distribution. Stack: Next.js 14 (App Router) + React,
Vercel hosting, Supabase (Postgres + Storage + Auth), Tailwind CSS.

## Key fixes vs. original spec
1. **Brands are a normalized many-to-many table**, not fixed columns
   (`brand_a_source`, `brand_b_source`...). New brands can be added via a
   `brands` table with zero schema migrations.
2. **Auth = Supabase Auth (email + password)**, scoped to a `sales_reps`
   allow-list. `created_by` is `auth.uid()`, not freetext.
3. **Photos are compressed client-side** (max 1600px, ~200KB) before
   upload to Supabase Storage, to control storage cost and table load time.
4. **Market share formula is explicit**: for a given region/tier,
   `% for brand X = (stores where brand X is a supplier) / (total stores in that region/tier) × 100`.
   A store can report multiple brand suppliers, so percentages do not need
   to sum to 100.
5. **RLS (Row Level Security)** is enabled on all tables — reps can insert
   and read, only admins can delete.

## Feature list (unchanged from original ask)
- Login (Supabase Auth)
- Sales entry form: store name, address, GPS (auto-grab + manual pin),
  photo capture/upload, tier select, multi-select brand suppliers
- Dashboard: aggregate market share % by brand, by region, by tier
- Store list: searchable/filterable/sortable table
- Store detail: photo, GPS, tier, brand suppliers, rep, timestamp
