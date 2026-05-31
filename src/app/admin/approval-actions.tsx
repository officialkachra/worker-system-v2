"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ApprovalActions({ logId }: { logId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("approve_log", { p_log_id: logId });
    setBusy(false);
    if (error) { alert("Error: " + error.message); return; }
    router.refresh();
  }
  async function reject() {
    const reason = prompt("Rejection ka reason (worker ko notify hoga):");
    if (reason === null) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reject_log", { p_log_id: logId, p_reason: reason });
    setBusy(false);
    if (error) { alert("Error: " + error.message); return; }
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button onClick={approve} disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-green text-white disabled:opacity-50">
        Approve
      </button>
      <button onClick={reject} disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e3b9b9] text-brand-red disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
