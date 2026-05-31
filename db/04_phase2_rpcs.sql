-- =====================================================================
-- 04_phase2_rpcs.sql — Phase 2 RPCs
-- Run in Supabase SQL Editor AFTER 01, 02, 03 (replaces older 04).
-- =====================================================================
-- Includes:
--   * add_product, set_product_rate, toggle_product
--   * toggle_worker
--   * add_adjustment (advance / bonus / penalty)
--   * record_payment_v2 (with optional date)
--   * reverse_ledger_entry (undo a payment/advance/bonus/penalty)
--   * submit_production_v2 (with date, supports admin-on-behalf)
--   * reverse_log (undo an approved log — creates a 'reversal' ledger entry)
-- =====================================================================

-- ---------- Products ----------
create or replace function add_product(
  p_name text, p_sku text, p_rate_paise int, p_qc_required boolean default false
) returns uuid as $$
declare v_pid uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  insert into products(name, sku, qc_required) values (p_name, p_sku, p_qc_required)
  returning id into v_pid;
  insert into product_rates(product_id, rate_paise, created_by)
  values (v_pid, p_rate_paise, auth.uid());
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'add_product','products',v_pid,
            jsonb_build_object('name',p_name,'sku',p_sku,'rate',p_rate_paise));
  return v_pid;
end $$ language plpgsql security definer;

create or replace function set_product_rate(p_product_id uuid, p_rate_paise int)
returns uuid as $$
declare v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  if p_rate_paise < 0 then raise exception 'Rate must be >= 0'; end if;
  insert into product_rates(product_id, rate_paise, created_by)
  values (p_product_id, p_rate_paise, auth.uid())
  returning id into v_id;
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'set_rate','product_rates',v_id,
            jsonb_build_object('product',p_product_id,'paise',p_rate_paise));
  return v_id;
end $$ language plpgsql security definer;

create or replace function toggle_product(p_product_id uuid, p_active boolean)
returns void as $$
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  update products set is_active = p_active where id = p_product_id;
end $$ language plpgsql security definer;

-- ---------- Workers ----------
create or replace function toggle_worker(p_worker_id uuid, p_active boolean)
returns void as $$
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  update profiles set is_active = p_active, updated_at = now() where id = p_worker_id;
end $$ language plpgsql security definer;

-- ---------- Adjustments (advance / bonus / penalty) ----------
create or replace function add_adjustment(
  p_worker_id uuid, p_kind ledger_kind, p_amount_paise int, p_note text default null
) returns uuid as $$
declare v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  if p_amount_paise <= 0 then raise exception 'Amount must be positive'; end if;
  if p_kind not in ('advance','bonus','penalty') then
    raise exception 'kind must be advance/bonus/penalty';
  end if;

  if p_kind = 'bonus' then
    insert into ledger_entries(worker_id, kind, credit_paise, description, is_locked, created_by)
    values (p_worker_id, p_kind, p_amount_paise, p_note, true, auth.uid())
    returning id into v_id;
  else
    insert into ledger_entries(worker_id, kind, debit_paise, description, is_locked, created_by)
    values (p_worker_id, p_kind, p_amount_paise, p_note, true, auth.uid())
    returning id into v_id;
  end if;

  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'add_'||p_kind,'ledger_entries',v_id,
            jsonb_build_object('worker',p_worker_id,'paise',p_amount_paise,'note',p_note));
  return v_id;
end $$ language plpgsql security definer;

-- ---------- Payment v2 (with optional payment date) ----------
create or replace function record_payment_v2(
  p_worker_id uuid, p_amount_paise int, p_mode payment_mode,
  p_note text default null, p_date date default null
) returns uuid as $$
declare v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  if p_amount_paise <= 0 then raise exception 'Amount must be positive'; end if;
  insert into ledger_entries(worker_id, kind, debit_paise, description, payment_mode,
                             is_locked, created_by, created_at)
  values (p_worker_id, 'payment', p_amount_paise, p_note, p_mode, true, auth.uid(),
          coalesce(p_date::timestamptz, now()))
  returning id into v_id;
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'record_payment','ledger_entries',v_id,
            jsonb_build_object('worker',p_worker_id,'paise',p_amount_paise,'mode',p_mode));
  return v_id;
end $$ language plpgsql security definer;

-- ---------- Reverse a ledger entry (REVERSAL MODEL) ----------
-- Inserts an opposite entry with kind='reversal', linked via description.
-- Does NOT delete or modify the original.
create or replace function reverse_ledger_entry(p_entry_id uuid, p_reason text)
returns uuid as $$
declare orig ledger_entries%rowtype; v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  select * into orig from ledger_entries where id = p_entry_id;
  if not found then raise exception 'Entry not found'; end if;
  if exists (select 1 from ledger_entries where description like 'REVERSAL of '||p_entry_id::text||'%') then
    raise exception 'Already reversed';
  end if;

  -- swap credit/debit
  insert into ledger_entries(worker_id, kind, credit_paise, debit_paise,
                             description, is_locked, created_by)
  values (orig.worker_id, 'reversal',
          orig.debit_paise, orig.credit_paise,
          'REVERSAL of '||p_entry_id::text||' — '||coalesce(p_reason,'no reason'),
          true, auth.uid())
  returning id into v_id;

  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'reverse_ledger','ledger_entries',p_entry_id,
            jsonb_build_object('reversal_id',v_id,'reason',p_reason));
  return v_id;
end $$ language plpgsql security definer;

-- ---------- Production v2 (with date, supports admin-on-behalf) ----------
-- If called by admin/supervisor with p_worker_id set, log is created for THAT
-- worker AND auto-approved (admin is vouching for it).
-- If called by worker, p_worker_id is ignored and log is pending as usual.
create or replace function submit_production_v2(
  p_product_id uuid, p_quantity int,
  p_work_date date default null, p_worker_id uuid default null,
  p_note text default null, p_proof text default null
) returns uuid as $$
declare
  v_rate int; v_id uuid; v_target uuid; v_status log_status;
  v_staff boolean := is_staff();
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  -- find the rate that was active on the work date (snapshot semantics)
  select rate_paise into v_rate
  from product_rates
  where product_id = p_product_id
    and effective_from <= coalesce(p_work_date::timestamptz, now())
  order by effective_from desc limit 1;
  if v_rate is null then raise exception 'No active rate for product on that date'; end if;

  -- decide whose log this is
  if v_staff and p_worker_id is not null then
    v_target := p_worker_id;
    v_status := 'approved';   -- admin entry = auto-approved
  else
    v_target := auth.uid();
    v_status := 'pending';
  end if;

  insert into production_logs(worker_id, product_id, quantity, rate_paise, amount_paise,
                              note, proof_url, work_date, status, reviewed_by, reviewed_at)
  values (v_target, p_product_id, p_quantity, v_rate, v_rate * p_quantity,
          p_note, p_proof, coalesce(p_work_date, current_date), v_status,
          case when v_status='approved' then auth.uid() else null end,
          case when v_status='approved' then now() else null end)
  returning id into v_id;

  if v_status = 'approved' then
    insert into audit_logs(actor_id, action, entity, entity_id, detail)
      values (auth.uid(),'admin_entered_log','production_logs',v_id,
              jsonb_build_object('worker',v_target,'qty',p_quantity,'date',p_work_date));
  end if;
  return v_id;
end $$ language plpgsql security definer;

-- ---------- Reverse an approved log ----------
-- Approved log = money in ledger. Reversing it = create a 'reversal' debit entry
-- that cancels the earning. Original log stays for audit.
create or replace function reverse_log(p_log_id uuid, p_reason text)
returns uuid as $$
declare lg production_logs%rowtype; v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  select * into lg from production_logs where id = p_log_id;
  if not found then raise exception 'Log not found'; end if;
  if lg.status <> 'approved' then raise exception 'Can only reverse approved logs'; end if;

  -- create a reversal entry that debits the worker by the earning amount
  insert into ledger_entries(worker_id, kind, debit_paise, description,
                             source_log_id, is_locked, created_by)
  values (lg.worker_id, 'reversal', lg.amount_paise,
          'Reversed log '||p_log_id::text||' — '||coalesce(p_reason,'no reason'),
          p_log_id, true, auth.uid())
  returning id into v_id;

  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'reverse_log','production_logs',p_log_id,
            jsonb_build_object('reversal_id',v_id,'reason',p_reason,'amount',lg.amount_paise));
  return v_id;
end $$ language plpgsql security definer;
