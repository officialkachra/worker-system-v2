"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Mode = "payment" | "advance" | "bonus" | "penalty" | "entry" | null;

export default function StatementActions({
  workerId, workerName,
}: { workerId: string; workerName: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const router = useRouter();

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => setMode("payment")}  primary>Payment</Btn>
        <Btn onClick={() => setMode("advance")}>+ Advance</Btn>
        <Btn onClick={() => setMode("bonus")}>+ Bonus</Btn>
        <Btn onClick={() => setMode("penalty")}>− Penalty</Btn>
        <Btn onClick={() => setMode("entry")}>+ Add entry</Btn>
      </div>
      {mode && mode !== "entry" && (
        <Modal title={`${capitalize(mode)} for ${workerName}`} onClose={() => setMode(null)}>
          <MoneyForm workerId={workerId} kind={mode} onDone={() => { setMode(null); router.refresh(); }} />
        </Modal>
      )}
      {mode === "entry" && (
        <Modal title={`Add entry for ${workerName}`} onClose={() => setMode(null)}>
          <EntryForm workerId={workerId} onDone={() => { setMode(null); router.refresh(); }} />
        </Modal>
      )}
    </>
  );
}

function Btn({ children, onClick, primary }: any) {
  return (
    <button onClick={onClick}
      className={`text-sm font-bold px-3 py-2 rounded-lg ${
        primary ? "bg-saffron text-white hover:bg-[#a8390b]"
                : "border border-[#e7ddcd] hover:bg-[#faf6ef]"
      }`}>
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-xl font-bold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function MoneyForm({ workerId, kind, onDone }: {
  workerId: string; kind: "payment" | "advance" | "bonus" | "penalty"; onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    const paise = Math.round(parseFloat(amount) * 100);
    if (!paise || paise <= 0) { setErr("Sahi rakam dalo"); return; }
    setBusy(true);
    const supabase = createClient();
    let error;
    if (kind === "payment") {
      ({ error } = await supabase.rpc("record_payment_v2", {
        p_worker_id: workerId, p_amount_paise: paise, p_mode: mode,
        p_note: note || null, p_date: date,
      }));
    } else {
      ({ error } = await supabase.rpc("add_adjustment", {
        p_worker_id: workerId, p_kind: kind, p_amount_paise: paise, p_note: note || null,
      }));
    }
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  }

  return (
    <>
      <Field label="Amount (₹)">
        <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="500" className="input" />
      </Field>
      {kind === "payment" && (
        <>
          <Field label="Mode">
            <select value={mode} onChange={e => setMode(e.target.value)} className="input">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              max={new Date().toISOString().slice(0,10)} className="input" />
          </Field>
        </>
      )}
      <Field label="Note (optional)">
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="reason / reference" className="input" />
      </Field>
      {err && <p className="text-sm text-brand-red my-2">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="w-full bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
        {busy ? "..." : "Save"}
      </button>
      <FormStyle />
    </>
  );
}

function EntryForm({ workerId, onDone }: { workerId: string; onDone: () => void }) {
  const [products, setProducts] = useState<{ id: string; name: string; rate: number }[]>([]);
  const [pid, setPid] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    setLoaded(true);
    const supabase = createClient();
    (async () => {
      const { data: ps } = await supabase.from("products").select("id,name").eq("is_active", true);
      const { data: rs } = await supabase.from("product_rates")
        .select("product_id,rate_paise,effective_from").order("effective_from", { ascending: true });
      const rateMap = new Map<string, number>();
      (rs ?? []).forEach(r => rateMap.set(r.product_id, r.rate_paise));
      const list = (ps ?? []).map(p => ({ id: p.id, name: p.name, rate: rateMap.get(p.id) ?? 0 }));
      setProducts(list);
      if (list.length) setPid(list[0].id);
    })();
  }

  const rate = products.find(p => p.id === pid)?.rate ?? 0;
  const total = rate * (parseInt(qty) || 0);

  async function submit() {
    setErr("");
    if (!pid) { setErr("Product chuno"); return; }
    const q = parseInt(qty);
    if (!q || q <= 0) { setErr("Sahi quantity dalo"); return; }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("submit_production_v2", {
      p_product_id: pid, p_quantity: q,
      p_work_date: date, p_worker_id: workerId,
      p_note: note || null, p_proof: null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  }

  return (
    <>
      <Field label="Product">
        <select value={pid} onChange={e => setPid(e.target.value)} className="input">
          {products.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{(p.rate/100).toFixed(0)}/pc</option>)}
        </select>
      </Field>
      <Field label="Quantity">
        <input type="number" inputMode="numeric" value={qty} onChange={e => setQty(e.target.value)}
          placeholder="20" className="input" />
      </Field>
      <Field label="Date (kis din ka kaam)">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          max={new Date().toISOString().slice(0,10)} className="input" />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={e => setNote(e.target.value)} className="input" />
      </Field>
      {total > 0 && (
        <div className="bg-[#fbf3df] border border-dashed border-[#b8860b] rounded-lg p-2.5 text-center mb-2">
          <span className="font-serif font-bold text-brand-amber">₹{(total/100).toFixed(0)}</span>
          <span className="text-xs text-brand-amber ml-2">(auto-approved — admin entry)</span>
        </div>
      )}
      {err && <p className="text-sm text-brand-red my-2">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="w-full bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
        {busy ? "..." : "Add entry"}
      </button>
      <FormStyle />
    </>
  );
}

function Field({ label, children }: any) {
  return <div className="mb-3">
    <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">{label}</label>
    {children}
  </div>;
}
function FormStyle() {
  return <style>{`.input { width: 100%; padding: 9px 11px; border: 1px solid #e7ddcd; border-radius: 8px; font-size: 14px; outline: none; background: white; }
    .input:focus { border-color: #c1440e; }`}</style>;
}
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
