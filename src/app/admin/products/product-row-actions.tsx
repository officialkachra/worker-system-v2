"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { rupee } from "@/lib/payroll";

export default function ProductRowActions({
  productId, productName, currentRate, isActive,
}: { productId: string; productName: string; currentRate: number; isActive: boolean }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(String(currentRate / 100));
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<{
    affected: number; oldTotal: number; newTotal: number;
  } | null>(null);
  const router = useRouter();

  async function checkImpact() {
    if (!effectiveFrom) { setErr("Effective from date chunein"); return; }
    const paise = Math.round(parseFloat(rate) * 100);
    if (paise < 0 || isNaN(paise)) { setErr("Sahi rate dalo"); return; }
    setErr("");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("preview_rate_change_impact", {
      p_product_id: productId, p_new_rate_paise: paise, p_effective_from: effectiveFrom,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const r = (data ?? [])[0];
    if (r && r.affected_count > 0) {
      setPreview({
        affected: r.affected_count,
        oldTotal: Number(r.total_old_paise),
        newTotal: Number(r.total_new_paise),
      });
    } else {
      setPreview({ affected: 0, oldTotal: 0, newTotal: 0 });
    }
  }

  async function saveRate() {
    if (!effectiveFrom) { setErr("Effective from date chunein"); return; }
    const paise = Math.round(parseFloat(rate) * 100);
    if (paise < 0 || isNaN(paise)) { setErr("Sahi rate dalo"); return; }
    setBusy(true);
    setErr("");
    const supabase = createClient();
    const { error } = await supabase.rpc("set_product_rate_v2", {
      p_product_id: productId, p_rate_paise: paise,
      p_effective_from: new Date(effectiveFrom).toISOString(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    close();
    router.refresh();
  }

  function close() {
    setOpen(false); setPreview(null); setErr("");
    setRate(String(currentRate / 100)); setEffectiveFrom("");
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

  const newPaise = Math.round(parseFloat(rate || "0") * 100);

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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl font-bold mb-2">Rate change — {productName}</h3>
            <p className="text-sm text-[#7a6e5e] mb-4">
              Naya rate aur date chuno. Date se purane saare approved entries ka paisa update ho jaayega.
            </p>

            <div className="mb-3">
              <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Naya rate (₹/piece)</label>
              <input type="number" inputMode="numeric" value={rate} onChange={e => { setRate(e.target.value); setPreview(null); }}
                className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base" />
            </div>

            <div className="mb-3">
              <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">
                Effective from (kis date se laagu hoga)
              </label>
              <input type="date" value={effectiveFrom} onChange={e => { setEffectiveFrom(e.target.value); setPreview(null); }}
                max={new Date().toISOString().slice(0,10)}
                className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base" />
              <p className="text-[11px] text-[#7a6e5e] mt-1">
                Backdate kar sakte ho — jaise 1 May 2026 chuno to May ka saara approved kaam naye rate par recalculate hoga.
              </p>
            </div>

            {err && <p className="text-sm text-brand-red my-2">{err}</p>}

            {preview && preview.affected > 0 && (
              <div className="bg-[#fbf1da] border border-[#ecd9a0] rounded-lg p-4 my-3 text-sm">
                <div className="font-bold text-brand-amber mb-2">⚠️ Heads up — agar tum naye entries banaoge</div>
                <div className="text-[#5a5042] space-y-1">
                  <div>Is date se aage <b>{preview.affected}</b> approved entries pehle se hain (purane rate par).</div>
                  <div>Purane rate par total: <b className="font-serif">{rupee(preview.oldTotal)}</b></div>
                  <div>Naye rate par hote to: <b className="font-serif">{rupee(preview.newTotal)}</b></div>
                  <div className="pt-1 border-t border-[#ecd9a0] mt-2 text-[11px]">
                    <b>Note:</b> purane approved entries automatic nahi badlenge (audit safety ke liye).
                    Sirf <b>naye entries</b> jo is date ke baad ki ho, naye rate par calculate hongi.
                    Agar purane entries bhi badalne hain, manually reverse karke wapas add karna padega.
                  </div>
                </div>
              </div>
            )}
            {preview && preview.affected === 0 && (
              <div className="bg-[#e6f2ec] border border-[#c5e3d3] rounded-lg p-3 my-3 text-sm">
                <div className="text-brand-green">✓ Koi purana approved entry affect nahi hoga.</div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={close} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
              {!preview ? (
                <button onClick={checkImpact} disabled={busy || !effectiveFrom || !rate}
                  className="flex-1 bg-[#5a5042] text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                  {busy ? "..." : "Check impact"}
                </button>
              ) : (
                <button onClick={saveRate} disabled={busy}
                  className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                  {busy ? "..." : "Confirm & Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
