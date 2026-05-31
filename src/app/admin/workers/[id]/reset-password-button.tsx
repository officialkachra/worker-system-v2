"use client";
import { useState } from "react";

export default function ResetPasswordButton({
  workerId, workerName, workerCode,
}: { workerId: string; workerName: string; workerCode: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ pw: string } | null>(null);

  async function submit() {
    setErr("");
    if (pw.length < 4) { setErr("Password kam se kam 4 character"); return; }
    setBusy(true);
    const r = await fetch("/api/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worker_id: workerId, new_password: pw, reason: reason || null }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Reset fail hua"); return; }
    setDone({ pw });
  }

  function close() {
    setOpen(false); setDone(null); setPw(""); setReason(""); setErr("");
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-sm font-bold px-3 py-2 rounded-lg border border-[#e7ddcd] hover:bg-[#faf6ef]">
        🔑 Reset password
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {!done ? (
              <>
                <h3 className="font-serif text-xl font-bold mb-1">Password reset</h3>
                <p className="text-sm text-[#7a6e5e] mb-4">
                  <b>{workerName}</b> ka naya password set karo. Ye paper par worker ko dena padega.
                </p>
                <div className="mb-3">
                  <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Naya password</label>
                  <input type="text" value={pw} onChange={e => setPw(e.target.value)}
                    placeholder="kuch aasaan (jaise neelu123)"
                    className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-base font-mono" />
                </div>
                <div className="mb-3">
                  <label className="block text-[12.5px] font-bold text-[#5a5042] mb-1">Reason (optional)</label>
                  <input value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="bhool gaya / new device"
                    className="w-full px-3 py-2 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron text-sm" />
                </div>
                {err && <p className="text-sm text-brand-red my-2">{err}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={close} className="flex-1 border border-[#e7ddcd] py-2.5 rounded-lg font-bold text-sm">Cancel</button>
                  <button onClick={submit} disabled={busy}
                    className="flex-1 bg-saffron text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-50">
                    {busy ? "..." : "Reset password"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-xl font-bold mb-3 text-brand-green">✓ Password reset ho gaya!</h3>
                <p className="text-sm mb-4">Ye details worker ko de do:</p>
                <div className="bg-[#fbf3df] border border-[#ecd9a0] rounded-lg p-4 mb-4">
                  <div className="text-xs text-[#7a6e5e] mb-1">LOGIN CODE</div>
                  <div className="font-mono font-bold text-lg mb-2">{workerCode}</div>
                  <div className="text-xs text-[#7a6e5e] mb-1">NAYA PASSWORD</div>
                  <div className="font-mono font-bold text-lg">{done.pw}</div>
                </div>
                <p className="text-xs text-[#7a6e5e] mb-4">
                  Worker ab is naye password se login kar paayega. Audit log mein ye reset record ho gaya hai.
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
