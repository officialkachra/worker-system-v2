import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// POST /api/change-password  { current_password, new_password }
// Any logged-in user. Verifies current password before changing.
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email)
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (typeof new_password !== "string" || new_password.length < 4)
    return NextResponse.json({ error: "Naya password 4 character ka chahiye" }, { status: 400 });

  // Verify current password by attempting sign-in
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: user.email, password: current_password,
  });
  if (signinErr)
    return NextResponse.json({ error: "Purana password galat hai" }, { status: 400 });

  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
