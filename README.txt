HOTFIX — 3 files to update on GitHub

WHAT IT FIXES:
1. Double counting bug: "Baaki due" was showing 2x of real amount
   (because approve_log RPC creates a duplicate 'earning' row in ledger).
   Now duePaise skips ledger 'earning' rows — they're treated as duplicates of production_logs.
2. "May 2026" hardcoded label → dynamic (shows actual current/previous month)
3. Statement timeline no longer shows duplicate "Approved production log" rows
4. Admin approval queue ab work_date column dikhata hai

WHAT TO DO:
1. Open your GitHub repo officialkachra/worker-system-v2
2. Navigate to each file path below
3. Click pencil/edit icon → paste new content → Commit changes (one at a time, OR upload all 3 together via "Upload files")

FILES TO REPLACE:
- src/lib/payroll.ts                              → use payroll.ts
- src/app/admin/workers/[id]/page.tsx              → use statement-page.tsx (rename to page.tsx after upload)
- src/app/admin/page.tsx                           → use admin-dashboard.tsx (rename to page.tsx after upload)

EASIER: zip mein original folder structure preserved hai — bas drag-drop.

NO DATABASE CHANGES NEEDED.
ALL EXISTING DATA STAYS SAFE — fix sirf calculation/display ka hai.

After upload → Netlify auto-deploy (2-3 min) → refresh page → "Baaki due" sahi number dikhega.
