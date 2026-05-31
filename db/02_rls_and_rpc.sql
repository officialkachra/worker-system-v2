-- =====================================================================
-- Row Level Security (RLS) — Phase 1
-- This is the file that enforces "workers NEVER see other workers' data."
-- Run AFTER 01_schema.sql.
-- =====================================================================
-- Model:
--   * worker  -> can read/write ONLY rows where worker_id = auth.uid()
--   * supervisor -> can read assigned workers + approve logs
--                   (Phase 1: supervisors can see all workers; assignment
--                    table comes in Phase 2. Flagged so it's not forgotten.)
--   * admin   -> full access
-- All financial writes still funnel through the ledger + triggers above.
-- =====================================================================

alter table profiles        enable row level security;
alter table products        enable row level security;
alter table product_rates   enable row level security;
alter table production_logs enable row level security;
alter table ledger_entries  enable row level security;
alter table attendance      enable row level security;
alter table notifications   enable row level security;
alter table audit_logs      enable row level security;
alter table departments     enable row level security;

-- ---------- PROFILES ----------
-- Worker reads own profile; staff read all.
create policy profiles_select on profiles for select
  using ( id = auth.uid() or is_staff() );
-- Only admin can create/edit/disable workers. Worker may edit a few of own fields
-- via a dedicated RPC (not raw update) — so we lock direct writes to admin here.
create policy profiles_admin_write on profiles for all
  using ( current_role_is('admin') )
  with check ( current_role_is('admin') );

-- ---------- DEPARTMENTS ----------
create policy dept_read on departments for select using ( true );
create policy dept_admin on departments for all
  using ( current_role_is('admin') ) with check ( current_role_is('admin') );

-- ---------- PRODUCTS / RATES ----------
-- Everyone logged in can READ products (workers need to pick them).
create policy products_read on products for select using ( auth.uid() is not null );
create policy products_admin on products for all
  using ( current_role_is('admin') ) with check ( current_role_is('admin') );

create policy rates_read on product_rates for select using ( auth.uid() is not null );
create policy rates_admin on product_rates for all
  using ( current_role_is('admin') ) with check ( current_role_is('admin') );

-- ---------- PRODUCTION LOGS ----------
-- Worker: read own, insert own (always as 'pending').
create policy logs_worker_read on production_logs for select
  using ( worker_id = auth.uid() or is_staff() );

create policy logs_worker_insert on production_logs for insert
  with check (
    worker_id = auth.uid()
    and status = 'pending'           -- workers cannot self-approve
  );

-- Worker may edit own log ONLY while still pending (fix a typo before review).
create policy logs_worker_update_pending on production_logs for update
  using ( worker_id = auth.uid() and status = 'pending' )
  with check ( worker_id = auth.uid() and status = 'pending' );

-- Staff: approve/reject/edit any log.
create policy logs_staff_update on production_logs for update
  using ( is_staff() ) with check ( is_staff() );

create policy logs_admin_delete on production_logs for delete
  using ( current_role_is('admin') );

-- ---------- LEDGER (money) ----------
-- Worker: READ-ONLY own ledger. Workers can NEVER write money rows.
create policy ledger_worker_read on ledger_entries for select
  using ( worker_id = auth.uid() or is_staff() );
-- Only admin inserts payments/advances/bonuses/penalties.
create policy ledger_admin_write on ledger_entries for all
  using ( current_role_is('admin') ) with check ( current_role_is('admin') );

-- ---------- ATTENDANCE ----------
create policy att_worker_read on attendance for select
  using ( worker_id = auth.uid() or is_staff() );
create policy att_worker_write on attendance for insert
  with check ( worker_id = auth.uid() );
create policy att_worker_update on attendance for update
  using ( worker_id = auth.uid() or is_staff() )
  with check ( worker_id = auth.uid() or is_staff() );

-- ---------- NOTIFICATIONS ----------
create policy notif_read on notifications for select
  using ( worker_id = auth.uid() or is_staff() );
create policy notif_update on notifications for update
  using ( worker_id = auth.uid() ) with check ( worker_id = auth.uid() );
create policy notif_staff_write on notifications for insert
  with check ( is_staff() );

-- ---------- AUDIT LOGS ----------
-- Append-only. Staff read. Nobody updates/deletes (no such policy = denied).
create policy audit_read on audit_logs for select using ( is_staff() );
create policy audit_insert on audit_logs for insert
  with check ( auth.uid() is not null );

-- =====================================================================
-- SECURE RPCs — the ONLY way money/approvals happen, so logic + audit
-- live server-side and can't be bypassed by a tampered client.
-- =====================================================================

-- Worker submits a production log: server snapshots the current rate.
create or replace function submit_production(
  p_product_id uuid, p_quantity int, p_note text default null, p_proof text default null
) returns uuid as $$
declare v_rate int; v_id uuid;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select rate_paise into v_rate
  from product_rates
  where product_id = p_product_id and effective_from <= now()
  order by effective_from desc limit 1;

  if v_rate is null then raise exception 'No active rate for product'; end if;

  insert into production_logs(worker_id, product_id, quantity, rate_paise, amount_paise, note, proof_url)
  values (auth.uid(), p_product_id, p_quantity, v_rate, v_rate * p_quantity, p_note, p_proof)
  returning id into v_id;

  return v_id;
end $$ language plpgsql security definer;

-- Staff approves a log (+ audit). Trigger handles the ledger earning.
create or replace function approve_log(p_log_id uuid) returns void as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  update production_logs
    set status='approved', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
    where id = p_log_id and status <> 'approved';
  insert into audit_logs(actor_id, action, entity, entity_id)
    values (auth.uid(), 'approve_log', 'production_logs', p_log_id);
end $$ language plpgsql security definer;

create or replace function reject_log(p_log_id uuid, p_reason text) returns void as $$
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  update production_logs
    set status='rejected', reviewed_by=auth.uid(), reviewed_at=now(),
        reject_reason=p_reason, updated_at=now()
    where id = p_log_id;
  insert into notifications(worker_id, title, body)
    select worker_id, 'Entry rejected', coalesce(p_reason,'No reason given')
    from production_logs where id = p_log_id;
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(), 'reject_log', 'production_logs', p_log_id, jsonb_build_object('reason',p_reason));
end $$ language plpgsql security definer;

-- Admin records a payment (locks it so it can't be silently deleted).
create or replace function record_payment(
  p_worker_id uuid, p_amount_paise int, p_mode payment_mode, p_note text default null
) returns uuid as $$
declare v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  if p_amount_paise <= 0 then raise exception 'Amount must be positive'; end if;
  insert into ledger_entries(worker_id, kind, debit_paise, description, payment_mode, is_locked, created_by)
  values (p_worker_id, 'payment', p_amount_paise, p_note, p_mode, true, auth.uid())
  returning id into v_id;
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'record_payment','ledger_entries',v_id,
            jsonb_build_object('worker',p_worker_id,'paise',p_amount_paise,'mode',p_mode));
  return v_id;
end $$ language plpgsql security definer;
