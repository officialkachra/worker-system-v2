"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={logout}
      className="text-xs text-[#c9bba6] border border-[#3a322a] px-3 py-1.5 rounded-lg hover:text-white">
      Logout
    </button>
  );
}
