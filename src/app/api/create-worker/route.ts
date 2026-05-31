import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

const DOMAIN = process.env.WORKER_LOGIN_DOMAIN || "sanskritagain.local";

// POST /api/create-worker  { full_name, phone, department_id, password, worker_code }
// Only an admin can call this. Creates an auth user (internal email from worker
// code) + a matching profile row. Worker logs in with code + password.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { full_name, phone, department_id, password, worker_code } = body;
  if (!full_name || !password || !worker_code)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();
  const email = `${String(worker_code).toLowerCase()}@${DOMAIN}`;

  // 1) create auth user
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

  // 2) create profile (admin client bypasses RLS for this privileged action)
  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id, role: "worker", full_name, phone: phone || null,
    department_id: department_id || null, worker_code, joining_date: new Date().toISOString().slice(0, 10),
  });
  if (profErr) {
    // rollback the orphaned auth user so we don't leave a half-created account
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, worker_code, login_email: email });
}
