"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function WorkersSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (q) sp.set("q", q); else sp.delete("q");
      router.replace("?" + sp.toString());
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="🔍 Worker code, naam, phone..."
        className="text-sm px-3 py-2 pl-9 border border-[#e7ddcd] rounded-lg outline-none focus:border-saffron w-72"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6e5e] text-sm pointer-events-none">🔍</span>
    </div>
  );
}
