-- =====================================================================
-- 06_round1.sql — password reset + rate effective_from + date-range queries
-- Run after 01-05. Idempotent.
-- =====================================================================

-- ---------- Password reset (admin only) ----------
-- NOTE: This calls auth.admin.update_user_by_id via SECURITY DEFINER.
-- It does NOT reveal the password — only allows setting a new one.
-- Implementation uses a public function that we expose to the API route.
-- (We keep the actual auth.admin call in the API route using service-role,
-- because Postgres can't call Supabase Auth REST API directly.)
-- The function below just validates that caller is admin and logs the action.

create or replace function log_password_reset(p_worker_id uuid, p_reason text default null)
returns void as $$
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'reset_password','profiles',p_worker_id,
            jsonb_build_object('reason', coalesce(p_reason, 'no reason')));
end $$ language plpgsql security definer;

-- ---------- set_product_rate with explicit effective_from ----------
-- Replaces the older version. Admin must specify effective_from.
create or replace function set_product_rate_v2(
  p_product_id uuid, p_rate_paise int, p_effective_from timestamptz
) returns uuid as $$
declare v_id uuid;
begin
  if not current_role_is('admin') then raise exception 'Admin only'; end if;
  if p_rate_paise < 0 then raise exception 'Rate must be >= 0'; end if;
  if p_effective_from is null then raise exception 'effective_from is required'; end if;

  insert into product_rates(product_id, rate_paise, effective_from, created_by)
  values (p_product_id, p_rate_paise, p_effective_from, auth.uid())
  returning id into v_id;

  insert into audit_logs(actor_id, action, entity, entity_id, detail)
    values (auth.uid(),'set_rate','product_rates',v_id,
            jsonb_build_object('product',p_product_id,'paise',p_rate_paise,'from',p_effective_from));
  return v_id;
end $$ language plpgsql security definer;

-- ---------- Preview impact: count of approved logs that would be affected ----------
-- by a rate change. Used for warning admin before they retroactively change.
create or replace function preview_rate_change_impact(
  p_product_id uuid, p_new_rate_paise int, p_effective_from timestamptz
) returns table (affected_count int, total_old_paise bigint, total_new_paise bigint) as $$
  select
    count(*)::int as affected_count,
    coalesce(sum(amount_paise),0)::bigint as total_old_paise,
    coalesce(sum(p_new_rate_paise * quantity),0)::bigint as total_new_paise
  from production_logs
  where product_id = p_product_id
    and status = 'approved'
    and work_date >= p_effective_from::date
$$ language sql stable security definer;

-- ---------- Date-range analytics ----------
create or replace function champions_range(p_from date, p_to date)
returns table (worker_id uuid, full_name text, worker_code text,
  total_paise bigint, total_qty bigint, days_worked int, rank int) as $$
  select p.id, p.full_name, p.worker_code,
    coalesce(sum(l.amount_paise),0)::bigint,
    coalesce(sum(l.quantity),0)::bigint,
    coalesce(count(distinct l.work_date),0)::int,
    row_number() over (order by coalesce(sum(l.amount_paise),0) desc)::int
  from profiles p
  left join production_logs l on l.worker_id = p.id and l.status = 'approved'
    and l.work_date between p_from and p_to
  where p.role = 'worker' and p.is_active = true
  group by p.id having coalesce(sum(l.amount_paise),0) > 0
  order by 4 desc
$$ language sql stable security definer;

create or replace function product_stats_range(p_from date, p_to date)
returns table (product_id uuid, product_name text, sku text,
  total_qty bigint, total_paise bigint, worker_count int, rank int) as $$
  select pr.id, pr.name, pr.sku,
    coalesce(sum(l.quantity),0)::bigint,
    coalesce(sum(l.amount_paise),0)::bigint,
    coalesce(count(distinct l.worker_id),0)::int,
    row_number() over (order by coalesce(sum(l.quantity),0) desc)::int
  from products pr
  left join production_logs l on l.product_id = pr.id and l.status = 'approved'
    and l.work_date between p_from and p_to
  group by pr.id order by 4 desc
$$ language sql stable security definer;

create or replace function daily_production_range(p_from date, p_to date)
returns table (work_date date, total_qty bigint, total_paise bigint) as $$
  select work_date, coalesce(sum(quantity),0)::bigint, coalesce(sum(amount_paise),0)::bigint
  from production_logs where status = 'approved'
    and work_date between p_from and p_to
  group by work_date order by work_date asc
$$ language sql stable security definer;

grant execute on function log_password_reset(uuid, text) to authenticated;
grant execute on function set_product_rate_v2(uuid, int, timestamptz) to authenticated;
grant execute on function preview_rate_change_impact(uuid, int, timestamptz) to authenticated;
grant execute on function champions_range(date, date) to authenticated;
grant execute on function product_stats_range(date, date) to authenticated;
grant execute on function daily_production_range(date, date) to authenticated;
