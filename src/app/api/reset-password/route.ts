import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase-server";

// POST /api/reset-password  { worker_id, new_password, reason? }
// Admin-only. Resets a worker's password and logs the action.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { worker_id, new_password, reason } = await req.json();
  if (!worker_id || !new_password)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (typeof new_password !== "string" || new_password.length < 4)
    return NextResponse.json({ error: "Password must be 4+ characters" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(worker_id, {
    password: new_password,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Log via RPC for audit trail
  await supabase.rpc("log_password_reset", {
    p_worker_id: worker_id, p_reason: reason || null,
  });

  return NextResponse.json({ ok: true });
}
