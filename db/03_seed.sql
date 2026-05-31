-- =====================================================================
-- 03_seed.sql — run AFTER 01_schema.sql and 02_rls_and_rpc.sql
-- Sets up products, rates, departments, and your first admin.
-- =====================================================================

-- Departments
insert into departments (name) values ('Binding'), ('Printing'), ('Finishing')
  on conflict (name) do nothing;

-- Products
insert into products (name, sku, category, qc_required) values
  ('Sundarkand',          'SK-01', 'Manuscript', true),
  ('Hanuman Chalisa',     'HC-01', 'Manuscript', false),
  ('Vishnu Sahasranama',  'VS-01', 'Manuscript', true),
  ('Bhaktamar Stotra',    'BS-01', 'Manuscript', false),
  ('Bajrang Baan',        'BB-01', 'Manuscript', false)
  on conflict (sku) do nothing;

-- Rates in PAISE (₹8 = 800). Adjust to your real rates.
insert into product_rates (product_id, rate_paise)
select id, case sku
  when 'SK-01' then 800
  when 'HC-01' then 500
  when 'VS-01' then 1200
  when 'BS-01' then 1000
  when 'BB-01' then 600
end
from products
where sku in ('SK-01','HC-01','VS-01','BS-01','BB-01');

-- =====================================================================
-- CREATE YOUR ADMIN ACCOUNT
-- =====================================================================
-- Step 1: In Supabase dashboard -> Authentication -> Users -> "Add user",
--         create a user with your email + a password. Copy its UUID.
-- Step 2: Paste that UUID below and run this block.
-- =====================================================================
-- insert into profiles (id, role, full_name, joining_date)
-- values ('PASTE-YOUR-AUTH-USER-UUID-HERE', 'admin', 'Yuvraj', current_date);
