"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

// Date range filter that writes to URL ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Server components read from searchParams and query accordingly.
export default function DateRangeFilter({ defaultPreset = "month" }: { defaultPreset?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [showCustom, setShowCustom] = useState(!!params.get("from") && !params.get("preset"));
  const currentPreset = params.get("preset") ?? (showCustom ? "" : defaultPreset);

  function applyPreset(preset: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("preset", preset);
    sp.delete("from"); sp.delete("to");
    setShowCustom(false);
    router.push("?" + sp.toString());
  }

  function applyCustom() {
    if (!from || !to) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("from", from); sp.set("to", to);
    sp.delete("preset");
    router.push("?" + sp.toString());
  }

  useEffect(() => {
    if (params.get("from")) setShowCustom(true);
  }, [params]);

  const presets = [
    { id: "week", label: "7 din" },
    { id: "month", label: "Is month" },
    { id: "prev_month", label: "Last month" },
    { id: "all", label: "All time" },
  ];

  const activeLabel = (() => {
    if (params.get("from")) return `${params.get("from")} → ${params.get("to")}`;
    return presets.find(p => p.id === currentPreset)?.label ?? "Is month";
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[11px] text-[#7a6e5e] uppercase font-bold mr-1">Filter:</span>
      {presets.map(p => (
        <button key={p.id} onClick={() => applyPreset(p.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
            currentPreset === p.id && !showCustom
              ? "bg-saffron text-white" : "bg-white border border-[#e7ddcd] hover:bg-[#fbeee7]"
          }`}>
          {p.label}
        </button>
      ))}
      <button onClick={() => setShowCustom(!showCustom)}
        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
          showCustom ? "bg-saffron text-white" : "bg-white border border-[#e7ddcd] hover:bg-[#fbeee7]"
        }`}>
        📅 Custom
      </button>
      {showCustom && (
        <div className="flex items-center gap-2 ml-2 bg-white border border-[#e7ddcd] rounded-lg px-2 py-1">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-xs outline-none bg-transparent" />
          <span className="text-xs text-[#7a6e5e]">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-xs outline-none bg-transparent" />
          <button onClick={applyCustom} disabled={!from || !to}
            className="bg-saffron text-white text-xs font-bold px-2 py-1 rounded disabled:opacity-50">
            Go
          </button>
        </div>
      )}
      <span className="ml-auto text-xs text-[#7a6e5e]">Showing: <b className="text-[#5a5042]">{activeLabel}</b></span>
    </div>
  );
}
