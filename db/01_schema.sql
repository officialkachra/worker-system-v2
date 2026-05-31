-- =====================================================================
-- SanskritAgain Worker Management System — Core Schema (Phase 1)
-- Target: Supabase (PostgreSQL)
-- =====================================================================
-- DESIGN PRINCIPLES
--   * Money is stored in PAISE (integer), never floats. ₹8.00 = 800.
--     Floating point rupees WILL cause payroll mismatches. Don't.
--   * Approved earnings are computed from approved logs only.
--   * Every destructive/financial action writes an audit_log row.
--   * RLS: workers see ONLY their own rows. Admin/supervisor scoped by role.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('admin', 'supervisor', 'worker');
exception when duplicate_object then null; end $$;

do $$ begin
  create type log_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_mode as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_kind as enum ('earning', 'payment', 'advance', 'bonus', 'penalty', 'reversal');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- DEPARTMENTS
-- =====================================================================
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- PROFILES  (1:1 with Supabase auth.users)
--   Every logged-in person has a row here. Role lives here.
-- =====================================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null default 'worker',
  full_name     text not null,
  phone         text unique,                     -- E.164 e.g. +919876543210
  photo_url     text,
  department_id uuid references departments(id),
  joining_date  date,
  is_active     boolean not null default true,
  notes         text,
  -- optional KYC, stored as private-bucket paths, not public URLs
  aadhaar_path  text,
  pan_path      text,
  emergency_contact text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A stable human-facing worker code (WRK-0001). Sequence-backed.
create sequence if not exists worker_code_seq start 1;
alter table profiles
  add column if not exists worker_code text unique;

-- =====================================================================
-- PRODUCTS  + rate history (never destroy old rates — payroll history
--   must reflect the rate that was active when the work was done)
-- =====================================================================
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  sku           text unique,
  category      text,
  qc_required   boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists product_rates (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  rate_paise      integer not null check (rate_paise >= 0),  -- ₹8 -> 800
  effective_from  timestamptz not null default now(),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_product_rates_lookup
  on product_rates(product_id, effective_from desc);

-- =====================================================================
-- PRODUCTION LOGS  (the heart of the system)
--   amount_paise is SNAPSHOTTED at entry time from the active rate,
--   so later rate changes never silently rewrite past earnings.
-- =====================================================================
create table if not exists production_logs (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references profiles(id) on delete restrict,
  product_id      uuid not null references products(id) on delete restrict,
  quantity        integer not null check (quantity > 0),
  rate_paise      integer not null check (rate_paise >= 0),  -- snapshot
  amount_paise    integer not null check (amount_paise >= 0),-- qty*rate snapshot
  note            text,
  proof_url       text,
  work_date       date not null default current_date,
  status          log_status not null default 'pending',
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_logs_worker  on production_logs(worker_id, work_date desc);
create index if not exists idx_logs_status  on production_logs(status) where status = 'pending';

-- =====================================================================
-- LEDGER  (single source of truth for money)
--   Earnings appear here ONLY when a log is approved (via trigger).
--   Payments/advances/bonuses/penalties are inserted by admin.
--   Balance is derived, never stored, to avoid drift.
-- =====================================================================
create table if not exists ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references profiles(id) on delete restrict,
  kind          ledger_kind not null,
  -- credit = money owed TO worker (earning/bonus). debit = money paid/penalty.
  credit_paise  integer not null default 0 check (credit_paise >= 0),
  debit_paise   integer not null default 0 check (debit_paise  >= 0),
  description   text,
  payment_mode  payment_mode,
  source_log_id uuid references production_logs(id),  -- for earning rows
  is_locked     boolean not null default false,       -- completed payments lock
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists idx_ledger_worker on ledger_entries(worker_id, created_at);

-- =====================================================================
-- ATTENDANCE
-- =====================================================================
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references profiles(id) on delete cascade,
  work_date   date not null default current_date,
  check_in     timestamptz,
  check_out    timestamptz,
  is_present   boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (worker_id, work_date)
);

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  worker_id   uuid not null references profiles(id) on delete cascade,
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notif_worker on notifications(worker_id, is_read);

-- =====================================================================
-- AUDIT LOG  (append-only; never updated or deleted)
-- =====================================================================
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  action      text not null,            -- 'approve_log','record_payment',etc
  entity      text not null,            -- table name
  entity_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_logs(entity, entity_id);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Auto-assign worker_code on insert if missing
create or replace function assign_worker_code() returns trigger as $$
begin
  if new.worker_code is null then
    new.worker_code := 'WRK-' || lpad(nextval('worker_code_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists trg_worker_code on profiles;
create trigger trg_worker_code before insert or update on profiles
  for each row execute function assign_worker_code();

-- When a production log flips to 'approved', post an earning to the ledger
-- exactly once. When flipped away from approved, remove that earning.
create or replace function sync_log_earning() returns trigger as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into ledger_entries(worker_id, kind, credit_paise, description, source_log_id, created_by)
    values (new.worker_id, 'earning', new.amount_paise,
            'Approved production log', new.id, new.reviewed_by);
  elsif old.status = 'approved' and new.status <> 'approved' then
    delete from ledger_entries where source_log_id = new.id and kind = 'earning';
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_sync_earning on production_logs;
create trigger trg_sync_earning after update on production_logs
  for each row execute function sync_log_earning();

-- Prevent deletion / mutation of locked (completed) ledger rows
create or replace function guard_locked_ledger() returns trigger as $$
begin
  if (tg_op = 'DELETE' and old.is_locked) then
    raise exception 'Locked payment cannot be deleted. Post a reversal instead.';
  end if;
  if (tg_op = 'UPDATE' and old.is_locked and new.is_locked) then
    raise exception 'Locked payment cannot be edited. Post a reversal instead.';
  end if;
  return coalesce(new, old);
end $$ language plpgsql;

drop trigger if exists trg_guard_ledger on ledger_entries;
create trigger trg_guard_ledger before update or delete on ledger_entries
  for each row execute function guard_locked_ledger();

-- =====================================================================
-- BALANCE VIEW  (derived, authoritative)
-- =====================================================================
create or replace view worker_balances as
select
  p.id as worker_id,
  p.full_name,
  p.worker_code,
  coalesce(sum(l.credit_paise),0) as total_credit_paise,
  coalesce(sum(l.debit_paise),0)  as total_debit_paise,
  coalesce(sum(l.credit_paise),0) - coalesce(sum(l.debit_paise),0) as balance_paise
from profiles p
left join ledger_entries l on l.worker_id = p.id
where p.role = 'worker'
group by p.id, p.full_name, p.worker_code;

-- =====================================================================
-- helper: is the current user an admin/supervisor?
-- =====================================================================
create or replace function current_role_is(target user_role)
returns boolean as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role = target
  );
$$ language sql stable security definer;

create or replace function is_staff() returns boolean as $$
  select exists(
    select 1 from profiles where id = auth.uid() and role in ('admin','supervisor')
  );
$$ language sql stable security definer;
