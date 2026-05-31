"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ProductRowActions({
  productId, productName, currentRate, isActive,
}: { productId: string; productName: string; currentRate: number; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(String(currentRate / 100));
  const [err, setErr] = useState("");
  const router = useRouter();

  async function saveRate() {
    setErr("");
    const paise = Math.round(parseFloat(rate) * 100);
    if (paise < 0 || isNaN(paise)) { setErr("Sahi rate dalo"); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_product_rate", {
      p_product_id: productId, p_rate_paise: paise,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    router.refresh();
  }

  async function toggle() {
    if (!confirm(isActive ? "Product inactive karen?" : "Product active karen?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("toggle_product", {
      p_product_id: productId, p_active: !isActive,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  return (
    <div className="flex gap-2 justify-end">
      <button onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e7ddcd] hover:bg-[#faf6ef]">
        Edit rate
      </button>
      <button onClick={toggle} disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e7ddcd] disabled:opacity-50">
        {isActive ? "Disable" : "Enable"}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl font-bold mb-2">Rate change — {productName}</h3>
            <p className="text-sm text-[#7a6e5e] mb-4">Purana approved kaam ka paisa nahi badlega. Aaj se naya rate lagega.</p>
            <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Naya rate (₹/piece)</label>
            <input type="number" inputMode="numeric" value={rate} onChange={e => setRate(e.target.value)}
              className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base" />
            {err && <p className="text-sm text-brand-red my-2">{err}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
              <button onClick={saveRate} disabled={busy}
                className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                {busy ? "..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
