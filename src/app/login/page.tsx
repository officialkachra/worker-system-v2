"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const WORKER_DOMAIN = "sanskritagain.local";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setErr(""); setBusy(true);
    const supabase = createClient();
    // If they typed a worker code (e.g. WRK-0001), turn it into the internal email.
    // If they typed an email, use it as-is (admin/supervisor).
    const looksLikeCode = /^WRK-\d+$/i.test(id.trim());
    const email = looksLikeCode
      ? `${id.trim().toLowerCase()}@${WORKER_DOMAIN}`
      : id.trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) { setErr("Galat code/email ya password. Dobara try karein."); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-[#e7ddcd] rounded-2xl p-7 shadow-sm">
        <div className="flex items-center gap-2 mb-1 font-bold text-lg">
          <span>संस्कृत</span>
          <span className="italic text-[#b8860b] font-serif">Again</span>
        </div>
        <p className="text-sm text-[#7a6e5e] mb-6">Worker System · Login</p>

        <label className="block text-xs font-bold text-[#5a5042] mb-1">
          Worker code ya Email
        </label>
        <input
          value={id} onChange={e => setId(e.target.value)}
          placeholder="WRK-0001 ya admin@email.com"
          className="w-full mb-4 px-3 py-2.5 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron"
        />
        <label className="block text-xs font-bold text-[#5a5042] mb-1">Password</label>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          className="w-full mb-5 px-3 py-2.5 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron"
        />
        {err && <p className="text-sm text-brand-red mb-4">{err}</p>}
        <button
          onClick={onSubmit} disabled={busy || !id || !pw}
          className="w-full bg-saffron text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {busy ? "Logging in…" : "Login"}
        </button>
      </div>
    </div>
  );
}
