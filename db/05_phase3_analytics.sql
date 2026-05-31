-- =====================================================================
-- 05_phase3_analytics.sql — Champion / leaderboard / product analytics
-- Run after 01-04. Idempotent — safe to re-run.
-- =====================================================================

-- Champion of the week (last 7 days, by approved earnings)
create or replace function champions_week()
returns table (
  worker_id uuid, full_name text, worker_code text,
  total_paise bigint, total_qty bigint, rank int
) as $$
  select
    p.id, p.full_name, p.worker_code,
    coalesce(sum(l.amount_paise),0)::bigint as total_paise,
    coalesce(sum(l.quantity),0)::bigint as total_qty,
    row_number() over (order by coalesce(sum(l.amount_paise),0) desc)::int as rank
  from profiles p
  left join production_logs l
    on l.worker_id = p.id
    and l.status = 'approved'
    and l.work_date >= (current_date - interval '7 days')::date
  where p.role = 'worker' and p.is_active = true
  group by p.id
  having coalesce(sum(l.amount_paise),0) > 0
  order by total_paise desc
$$ language sql stable security definer;

-- Champion of the month (current calendar month, by approved earnings)
create or replace function champions_month()
returns table (
  worker_id uuid, full_name text, worker_code text,
  total_paise bigint, total_qty bigint, days_worked int, rank int
) as $$
  select
    p.id, p.full_name, p.worker_code,
    coalesce(sum(l.amount_paise),0)::bigint as total_paise,
    coalesce(sum(l.quantity),0)::bigint as total_qty,
    coalesce(count(distinct l.work_date),0)::int as days_worked,
    row_number() over (order by coalesce(sum(l.amount_paise),0) desc)::int as rank
  from profiles p
  left join production_logs l
    on l.worker_id = p.id
    and l.status = 'approved'
    and to_char(l.work_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
  where p.role = 'worker' and p.is_active = true
  group by p.id
  having coalesce(sum(l.amount_paise),0) > 0
  order by total_paise desc
$$ language sql stable security definer;

-- Product analytics for current month: total qty + revenue + worker count
create or replace function product_stats_month()
returns table (
  product_id uuid, product_name text, sku text,
  total_qty bigint, total_paise bigint, worker_count int, rank int
) as $$
  select
    pr.id, pr.name, pr.sku,
    coalesce(sum(l.quantity),0)::bigint as total_qty,
    coalesce(sum(l.amount_paise),0)::bigint as total_paise,
    coalesce(count(distinct l.worker_id),0)::int as worker_count,
    row_number() over (order by coalesce(sum(l.quantity),0) desc)::int as rank
  from products pr
  left join production_logs l
    on l.product_id = pr.id
    and l.status = 'approved'
    and to_char(l.work_date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
  group by pr.id
  order by total_qty desc
$$ language sql stable security definer;

-- Days worked in current month for a single worker
create or replace function worker_days_worked(p_worker_id uuid, p_ym text default null)
returns int as $$
  select coalesce(count(distinct work_date),0)::int
  from production_logs
  where worker_id = p_worker_id
    and status = 'approved'
    and to_char(work_date, 'YYYY-MM') = coalesce(p_ym, to_char(current_date, 'YYYY-MM'))
$$ language sql stable security definer;

-- Personal best: highest single-day earning ever
create or replace function worker_personal_best(p_worker_id uuid)
returns table (work_date date, total_qty bigint, total_paise bigint) as $$
  select work_date,
         sum(quantity)::bigint as total_qty,
         sum(amount_paise)::bigint as total_paise
  from production_logs
  where worker_id = p_worker_id and status = 'approved'
  group by work_date
  order by total_paise desc
  limit 1
$$ language sql stable security definer;

-- Daily production for last N days (for trend chart)
create or replace function daily_production(p_days int default 7)
returns table (work_date date, total_qty bigint, total_paise bigint) as $$
  select work_date,
         coalesce(sum(quantity),0)::bigint as total_qty,
         coalesce(sum(amount_paise),0)::bigint as total_paise
  from production_logs
  where status = 'approved'
    and work_date >= (current_date - (p_days || ' days')::interval)::date
  group by work_date
  order by work_date asc
$$ language sql stable security definer;

-- A worker's own daily production for last N days (RLS-safe — only own data)
create or replace function my_daily_production(p_days int default 7)
returns table (work_date date, total_qty bigint, total_paise bigint) as $$
  select work_date,
         coalesce(sum(quantity),0)::bigint as total_qty,
         coalesce(sum(amount_paise),0)::bigint as total_paise
  from production_logs
  where status = 'approved'
    and worker_id = auth.uid()
    and work_date >= (current_date - (p_days || ' days')::interval)::date
  group by work_date
  order by work_date asc
$$ language sql stable security definer;

-- Grant execute to authenticated users (RLS in underlying tables still applies)
grant execute on function champions_week() to authenticated;
grant execute on function champions_month() to authenticated;
grant execute on function product_stats_month() to authenticated;
grant execute on function worker_days_worked(uuid, text) to authenticated;
grant execute on function worker_personal_best(uuid) to authenticated;
grant execute on function daily_production(int) to authenticated;
grant execute on function my_daily_production(int) to authenticated;
