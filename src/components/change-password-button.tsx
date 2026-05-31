"use client";
import { useState } from "react";

export default function ChangePasswordButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [open, setOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    setErr("");
    if (newPw.length < 4) { setErr("Naya password 4 character ka chahiye"); return; }
    if (newPw !== confirmPw) { setErr("Dono naye password match nahi karte"); return; }
    setBusy(true);
    const r = await fetch("/api/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: oldPw, new_password: newPw }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Password change fail hua"); return; }
    setDone(true);
  }

  function close() {
    setOpen(false); setDone(false); setOldPw(""); setNewPw(""); setConfirmPw(""); setErr("");
  }

  const btnCls = variant === "dark"
    ? "text-xs text-[#c9bba6] border border-[#3a322a] px-3 py-1.5 rounded-lg hover:text-white whitespace-nowrap"
    : "text-xs font-bold text-[#5a5042] border border-[#e7ddcd] px-3 py-1.5 rounded-lg hover:bg-[#faf6ef] whitespace-nowrap";

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnCls}>
        🔑 Password
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-[#1a1410]" onClick={e => e.stopPropagation()}>
            {!done ? (
              <>
                <h3 className="font-serif text-xl font-bold mb-1">Password change karo</h3>
                <p className="text-sm text-[#7a6e5e] mb-4">Apna naya password set karo</p>

                <div className="mb-3">
                  <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Purana password</label>
                  <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base" />
                </div>
                <div className="mb-3">
                  <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Naya password</label>
                  <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base font-mono" />
                </div>
                <div className="mb-3">
                  <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Naya password (phir se)</label>
                  <input type="text" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base font-mono" />
                </div>
                {err && <p className="text-sm text-brand-red my-2">{err}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={close} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
                  <button onClick={submit} disabled={busy}
                    className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                    {busy ? "..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-xl font-bold mb-3 text-brand-green">✓ Password badal gaya!</h3>
                <p className="text-sm text-[#7a6e5e] mb-4">
                  Ab se aap naye password se login karoge.
                </p>
                <button onClick={close} className="w-full bg-saffron text-white py-2.5 rounded-lg font-bold text-sm">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
