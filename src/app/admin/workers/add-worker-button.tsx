"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddWorkerButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ code: string; pw: string } | null>(null);
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");

  async function submit() {
    setErr("");
    if (!name.trim()) { setErr("Naam zaroori hai"); return; }
    if (!code.trim()) { setErr("Worker code zaroori hai (jaise WRK-0001)"); return; }
    if (pw.length < 4) { setErr("Password kam se kam 4 character"); return; }
    setBusy(true);
    const r = await fetch("/api/create-worker", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name.trim(), phone: phone.trim() || null,
        worker_code: code.trim().toUpperCase(), password: pw,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Kuch galti hui"); return; }
    setDone({ code: code.trim().toUpperCase(), pw });
    setName(""); setPhone(""); setCode(""); setPw("");
    router.refresh();
  }

  function close() {
    setOpen(false); setDone(null); setErr("");
    setName(""); setPhone(""); setCode(""); setPw("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-saffron text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#a8390b]">
        + Add worker
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {!done ? (
              <>
                <h3 className="font-serif text-xl font-bold mb-1">Naya worker</h3>
                <p className="text-sm text-[#7a6e5e] mb-4">Yahan worker ka login banao. Code aur password worker ko paper par dena.</p>

                <Field label="Naam *">
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ramesh Kumar" className="input" />
                </Field>
                <Field label="Worker code *">
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="WRK-0001" className="input font-mono" />
                  <p className="text-xs text-[#7a6e5e] mt-1">Format: WRK-0001, WRK-0002, etc.</p>
                </Field>
                <Field label="Phone (optional)">
                  <input value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98765 43210" className="input" />
                </Field>
                <Field label="Password *">
                  <input type="text" value={pw} onChange={e => setPw(e.target.value)}
                    placeholder="kuch aasaan (ramesh123)" className="input" />
                  <p className="text-xs text-[#7a6e5e] mt-1">Worker is se login karega. Yaad rakhne layak rakho.</p>
                </Field>

                {err && <p className="text-sm text-brand-red my-2">{err}</p>}
                <div className="flex gap-2 mt-5">
                  <button onClick={close} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
                  <button onClick={submit} disabled={busy}
                    className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                    {busy ? "Ban raha hai..." : "Save worker"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-xl font-bold mb-3 text-brand-green">✓ Worker ban gaya!</h3>
                <p className="text-sm mb-4">Ye details worker ko de do — phone par paper par jo bhi:</p>
                <div className="bg-[#fbf3df] border border-[#ecd9a0] rounded-lg p-4 mb-4">
                  <div className="text-xs text-[#7a6e5e] mb-1">LOGIN CODE</div>
                  <div className="font-mono font-bold text-lg mb-2">{done.code}</div>
                  <div className="text-xs text-[#7a6e5e] mb-1">PASSWORD</div>
                  <div className="font-mono font-bold text-lg">{done.pw}</div>
                </div>
                <p className="text-xs text-[#7a6e5e] mb-4">
                  Worker site par jaa ke code + password daalega → uska app khulega.
                </p>
                <button onClick={close} className="w-full bg-saffron text-white py-2.5 rounded-lg font-bold text-sm">Done</button>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`.input { width: 100%; padding: 9px 11px; border: 1px solid #e7ddcd; border-radius: 8px; font-size: 14px; outline: none; }
        .input:focus { border-color: #c1440e; }`}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3">
    <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">{label}</label>
    {children}
  </div>;
}
