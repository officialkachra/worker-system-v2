"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function WorkerRowActions({
  workerId, isActive,
}: { workerId: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!confirm(isActive ? "Worker ko inactive karen?" : "Worker ko active karen?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_worker", {
      p_worker_id: workerId, p_active: !isActive,
    });
    setBusy(false);
    if (error) { alert("Error: " + error.message); return; }
    router.refresh();
  }

  return (
    <div className="flex gap-2 justify-end">
      <Link href={`/admin/workers/${workerId}`}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e7ddcd] hover:bg-[#faf6ef]">
        Statement
      </Link>
      <button onClick={toggle} disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e7ddcd] disabled:opacity-50">
        {isActive ? "Disable" : "Enable"}
      </button>
    </div>
  );
}
