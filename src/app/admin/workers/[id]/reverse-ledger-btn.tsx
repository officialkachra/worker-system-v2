"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ReverseLedgerBtn({ entryId }: { entryId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reverse() {
    const reason = prompt("Reversal ka reason (audit ke liye):");
    if (reason === null) return;
    if (!confirm("Pakka reverse karna hai? Ek opposite entry ban jaayegi, original entry rahegi (audit ke liye).")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reverse_ledger_entry", {
      p_entry_id: entryId, p_reason: reason || "no reason",
    });
    setBusy(false);
    if (error) { alert("Error: " + error.message); return; }
    router.refresh();
  }

  return (
    <button onClick={reverse} disabled={busy}
      className="text-[11px] font-bold px-2 py-1 rounded border border-[#e3b9b9] text-brand-red disabled:opacity-50">
      Reverse
    </button>
  );
}
