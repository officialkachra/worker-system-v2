"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ReverseLogBtn({ logId }: { logId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reverse() {
    const reason = prompt("Entry galat thi? Reason batao (audit ke liye):");
    if (reason === null) return;
    if (!confirm("Pakka? Entry ka paisa worker ke ledger se hat jaayega (reversal entry banegi). Original entry audit ke liye rahegi.")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reverse_log", {
      p_log_id: logId, p_reason: reason || "no reason",
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
