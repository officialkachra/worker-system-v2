# SanskritAgain Worker System — Deploy Guide

Real Next.js 14 + Supabase app. Production, approvals, payroll (calendar-month),
attendance-ready, role-based (admin / supervisor / worker), with RLS so workers
**never** see each other's data or salaries.

> Your existing Firebase app stays untouched. This is a separate, parallel system.
> Migrate Firebase data only AFTER this is verified working (see step 6).

---

## What's inside
```
app/
  db/                      <- run these in Supabase, in order
    01_schema.sql          tables, triggers, balance view
    02_rls_and_rpc.sql     row-level security + secure functions
    03_seed.sql            products, rates, departments, your admin
  src/
    app/                   login, role router, /admin /supervisor /worker, API
    lib/                   supabase clients + payroll math (money in paise)
    middleware.ts          session refresh + route protection
  .env.local.example       copy to .env.local and fill in
```

---

## Step 1 — Create a Supabase project
1. Go to supabase.com, create a new project (free tier is fine to start).
2. Wait for it to finish provisioning (~2 min).

## Step 2 — Run the database files (IN ORDER)
Supabase dashboard → **SQL Editor** → New query. Paste and run each file:
1. `db/01_schema.sql`
2. `db/02_rls_and_rpc.sql`
3. `db/03_seed.sql`  (products + rates + departments)

## Step 3 — Create your admin login
1. Dashboard → **Authentication → Users → Add user**. Use your email + a password.
   Tick "Auto confirm". Copy the new user's **UUID**.
2. SQL Editor → run (paste your UUID):
   ```sql
   insert into profiles (id, role, full_name, joining_date)
   values ('YOUR-UUID-HERE', 'admin', 'Yuvraj', current_date);
   ```

## Step 4 — Get your API keys
Dashboard → **Project Settings → API**. You need three values:
- Project URL
- `anon` public key
- `service_role` key (secret — server only)

Copy `.env.local.example` to `.env.local` and fill them in.

## Step 5 — Deploy to Vercel (recommended)
1. Push this folder to a GitHub repo (your `officialkachra` org works).
2. vercel.com → New Project → import the repo.
3. Add the same three env vars from `.env.local` in Vercel's
   **Settings → Environment Variables** (plus `WORKER_LOGIN_DOMAIN`).
4. Deploy. Done — you get a live URL.

Run locally instead:
```bash
npm install
npm run dev      # http://localhost:3000
```

## Step 6 — Create workers
Log in as admin → workers get created via the **Add worker** flow
(`POST /api/create-worker`), which makes their login automatically:
- Worker code `WRK-0001` → they log in with code `WRK-0001` + the password you set.
- They never need a real email; the system makes an internal one for them.

Hand each worker their code + password on paper. That's their login.

---

## Money & payroll notes (important)
- **All money is stored in paise** (₹8 = 800). Never changed to floats. This is
  why payroll totals always reconcile.
- **Earnings only count when approved.** A pending entry is not money yet.
- **Rate is snapshotted** when the worker submits. Changing a product's rate later
  never rewrites past approved earnings.
- **Advance** reduces "due" (paisa already given). **Bonus** adds, **penalty**
  subtracts. Due = earnings + bonus − payments − advance − penalty.
- **Payments are locked** once recorded — reversal-with-note only, never silent delete.
- **Payroll cycle = calendar month** (1st → month-end), per your choice.

## Security
- RLS is ON for every table. A worker's token can only read their own rows —
  enforced in Postgres, not just the UI.
- Approvals and payments go through `SECURITY DEFINER` RPCs that write audit_logs.
- The `service_role` key is used only in the server-side API route, never shipped
  to the browser.

## Migrating your live Firebase data (do this LAST)
Once this system is verified with test data:
1. Export Firestore (Firebase console or `gcloud firestore export`).
2. Share the export structure — a migration script maps your old fields to this
   schema (workers, logs, payments), keeps the Firebase export as a permanent
   backup, and reconciles row counts before any cutover.
3. Old app keeps running until counts match. Zero data loss.

## Not built yet (Phase 2 — say the word)
Attendance UI, WhatsApp/PDF salary slips, analytics charts, full audit viewer,
adjustments UI (advance/bonus/penalty buttons), worker photo upload.
The database already supports all of these — they're frontend work.
