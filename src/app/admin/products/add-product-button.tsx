"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AddProductButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [rate, setRate] = useState("");
  const [qc, setQc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit() {
    setErr("");
    if (!name.trim()) { setErr("Name zaroori hai"); return; }
    const ratePaise = Math.round(parseFloat(rate) * 100);
    if (!ratePaise || ratePaise <= 0) { setErr("Sahi rate dalo"); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_product", {
      p_name: name.trim(), p_sku: sku.trim() || null,
      p_rate_paise: ratePaise, p_qc_required: qc,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    setName(""); setSku(""); setRate(""); setQc(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-saffron text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#a8390b]">
        + Add product
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl font-bold mb-4">Naya product</h3>
            <Field label="Name">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Vishnu Sahasranama" className="input" />
            </Field>
            <Field label="SKU (optional)">
              <input value={sku} onChange={e => setSku(e.target.value)}
                placeholder="VS-01" className="input font-mono" />
            </Field>
            <Field label="Rate per piece (₹)">
              <input type="number" inputMode="numeric" value={rate} onChange={e => setRate(e.target.value)}
                placeholder="12" className="input" />
            </Field>
            <label className="flex items-center gap-2 mb-3 text-sm">
              <input type="checkbox" checked={qc} onChange={e => setQc(e.target.checked)} />
              QC required (quality check zaroori)
            </label>
            {err && <p className="text-sm text-brand-red my-2">{err}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setOpen(false)} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
              <button onClick={submit} disabled={busy}
                className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                {busy ? "..." : "Save"}
              </button>
            </div>
            <style>{`.input { width: 100%; padding: 9px 11px; border: 1px solid #e7ddcd; border-radius: 8px; font-size: 14px; outline: none; }
              .input:focus { border-color: #c1440e; }`}</style>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: any) {
  return <div className="mb-3">
    <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">{label}</label>
    {children}
  </div>;
}
