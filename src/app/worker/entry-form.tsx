"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { rupee } from "@/lib/payroll";

type P = { id: string; name: string; rate: number };

export default function WorkerEntryForm({ products }: { products: P[] }) {
  const router = useRouter();
  const [pid, setPid] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(20);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rate = products.find(p => p.id === pid)?.rate ?? 0;
  const total = rate * (qty || 0);
  const today = new Date().toISOString().slice(0,10);

  async function submit() {
    if (!pid || qty <= 0) { setMsg("Sahi product aur quantity chunein"); return; }
    setBusy(true); setMsg("");
    const supabase = createClient();
    // v2 RPC supports date. For workers, p_worker_id stays null so log goes as 'pending'.
    const { error } = await supabase.rpc("submit_production_v2", {
      p_product_id: pid, p_quantity: qty,
      p_work_date: date, p_worker_id: null,
      p_note: note || null, p_proof: null,
    });
    setBusy(false);
    if (error) { setMsg("Error: " + error.message); return; }
    setMsg("Submitted! Approval ka intezaar / स्वीकृति का इंतज़ार");
    setQty(20); setNote(""); setDate(today);
    router.refresh();
  }

  return (
    <div>
      <Field label="Product / उत्पाद">
        <select value={pid} onChange={e => setPid(e.target.value)}
          className="w-full px-3 py-2.5 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-[15px]">
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {rupee(p.rate)}/pc</option>
          ))}
        </select>
      </Field>
      <Field label="Quantity / मात्रा">
        <input type="number" inputMode="numeric" min={1} value={qty}
          onChange={e => setQty(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2.5 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-[15px]" />
      </Field>
      <Field label="Date / तारीख (kis din ka kaam)">
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2.5 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-[15px]" />
      </Field>

      <div className="bg-[#fbf3df] border border-dashed border-gold rounded-lg p-3 text-center my-3">
        <div className="text-[13px] text-brand-amber">{qty || 0} × {rupee(rate)}</div>
        <div className="font-serif text-2xl font-bold text-brand-amber">{rupee(total)}</div>
      </div>

      <button onClick={submit} disabled={busy}
        className="w-full bg-saffron text-white font-bold py-3.5 rounded-xl text-base disabled:opacity-50">
        {busy ? "…" : "Submit / जमा करें"}
      </button>
      {msg && <p className="text-sm text-center mt-3 text-[#5a5042]">{msg}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
