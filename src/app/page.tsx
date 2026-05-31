import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// Reads the logged-in user's role from `profiles` and routes them.
export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "admin": redirect("/admin");
    case "supervisor": redirect("/supervisor");
    case "worker": redirect("/worker");
    default: redirect("/login");
  }
}
