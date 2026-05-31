import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm, shortDate,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";
import WorkerEntryForm from "./entry-form";
import LogoutButton from "@/components/logout-button";

export const dynamic = "force-dynamic";

type MonthChamp = {
  worker_id: string; full_name: string; worker_code: string;
  total_paise: number; total_qty: number; days_worked: number; rank: number;
};
type DailyProd = { work_date: string; total_qty: number; total_paise: number };

export default async function WorkerHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const wid = user.id;

  const [meR, logsR, ledgerR, productsR, ratesR, monthR, daysR, bestR, dailyR] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("production_logs").select("*").order("work_date", { ascending: false }),
    supabase.from("ledger_entries").select("*"),
    supabase.from("products").select("id,name").eq("is_active", true),
    supabase.from("product_rates").select("product_id,rate_paise,effective_from"),
    supabase.rpc("champions_month"),
    supabase.rpc("worker_days_worked", { p_worker_id: wid, p_ym: null }),
    supabase.rpc("worker_personal_best", { p_worker_id: wid }),
    supabase.rpc("my_daily_production", { p_days: 7 }),
  ]);

  const me = meR.data;
  const L = (logsR.data ?? []) as ProductionLog[];
  const Led = (ledgerR.data ?? []) as LedgerEntry[];
  const monthChamps = (monthR.data ?? []) as MonthChamp[];
  const daysWorked = (daysR.data as number) ?? 0;
  const personalBest = (bestR.data ?? [])[0] ?? null;
  const daily = (dailyR.data ?? []) as DailyProd[];

  const cur = earnedPaise(L, wid, currentYm());
  const prev = earnedPaise(L, wid, prevYm());
  const advance = ledgerSum(Led, wid, "advance");
  const due = duePaise(L, Led, wid);

  const myRank = monthChamps.find(c => c.worker_id === wid);
  const myRankNum = myRank?.rank ?? null;
  const personAbove = myRank && myRank.rank > 1
    ? monthChamps.find(c => c.rank === myRank.rank - 1) : null;
  const gapToNext = personAbove ? Number(personAbove.total_paise) - Number(myRank!.total_paise) : 0;

  // Rate map for entry form
  const rateMap = new Map<string, number>();
  ((ratesR.data ?? []) as { product_id: string; rate_paise: number; effective_from: string }[])
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    .forEach(r => rateMap.set(r.product_id, r.rate_paise));
  const productList = (productsR.data ?? []).map(p => ({
    id: p.id, name: p.name, rate: rateMap.get(p.id) ?? 0,
  }));

  const maxDailyQty = Math.max(...daily.map(d => Number(d.total_qty)), 1);

  return (
    <div className="max-w-md mx-auto min-h-screen pb-8">
      {/* HEADER with greeting */}
      <div className="text-white px-5 py-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1410 0%, #2c241c 100%)" }}>
        <div className="absolute -right-4 -top-4 text-6xl opacity-10">🙏</div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-[#c9bba6]">नमस्ते 🙏</div>
          <LogoutButton />
        </div>
        <div className="font-serif text-2xl font-bold">{me?.full_name}</div>
        <div className="text-[11px] text-[#c9bba6] font-mono">{me?.worker_code}</div>
      </div>

      <div className="p-4 space-y-4">

        {/* ========== HERO: Pending balance ========== */}
        <div className="rounded-2xl p-5 text-center text-white relative overflow-hidden shadow-lg animate-fade-in-up"
          style={{ background: "linear-gradient(135deg, #c1440e 0%, #a01a1a 100%)" }}>
          <div className="absolute top-3 right-3 text-[#f5b730] opacity-30 text-2xl">✦</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#f5b730] font-bold">
            Aapka pending paisa
          </div>
          <div className="font-serif text-5xl font-bold my-1">{rupee(due)}</div>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
            <Mini label="Is month" value={rupee(cur)} />
            <Mini label="Last month" value={rupee(prev)} />
            <Mini label="Advance" value={rupee(advance)} />
          </div>
        </div>

        {/* ========== MY RANK ========== */}
        {myRankNum && (
          <div className="rounded-2xl p-5 relative overflow-hidden animate-fade-in-up"
            style={{
              background: myRankNum === 1
                ? "linear-gradient(135deg, #fbf3df 0%, #f5b730 100%)"
                : "linear-gradient(135deg, #fbeee7 0%, #fbf3df 100%)",
              animationDelay: "100ms",
            }}>
            <div className="flex items-center gap-4">
              <div className="text-5xl">
                {myRankNum === 1 ? "🏆" : myRankNum === 2 ? "🥈" : myRankNum === 3 ? "🥉" : "⭐"}
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#8a5a00]">
                  Is month aapka rank
                </div>
                <div className="font-serif text-4xl font-bold text-[#5a3a00]">
                  #{myRankNum}
                </div>
                <div className="text-xs text-[#5a3a00]">
                  {monthChamps.length} workers mein
                </div>
              </div>
            </div>
            {personAbove && gapToNext > 0 && (
              <div className="mt-4 pt-4 border-t border-[#b8860b]/30 text-sm text-[#5a3a00]">
                <span className="font-bold">{rupee(gapToNext)}</span> aur kamao to <span className="font-bold">{personAbove.full_name}</span> ko paar kar denge! 🚀
              </div>
            )}
            {myRankNum === 1 && (
              <div className="mt-4 pt-4 border-t border-[#b8860b]/30 text-sm text-[#5a3a00] font-bold">
                🎉 Aap top par hain! Apna lead banaye rakho.
              </div>
            )}
          </div>
        )}

        {/* ========== STATS ROW ========== */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            emoji={daysWorked >= 20 ? "🔥" : daysWorked >= 10 ? "⭐" : "📅"}
            label="Din kaam kiya"
            value={`${daysWorked}`}
            sub="is month"
          />
          <StatCard
            emoji="🎯"
            label="Personal best"
            value={personalBest ? `${personalBest.total_qty}` : "—"}
            sub={personalBest ? `pcs · ${shortDate(personalBest.work_date)}` : "abhi banaya nahi"}
          />
        </div>

        {/* ========== MY DAILY CHART ========== */}
        {daily.length > 0 && (
          <div className="bg-white border border-[#e7ddcd] rounded-2xl p-4">
            <div className="text-xs font-bold text-[#5a5042] uppercase tracking-wide mb-3">
              📈 Last 7 din
            </div>
            <div className="flex items-end gap-2 h-24">
              {daily.map(d => {
                const h = Math.max((Number(d.total_qty) / maxDailyQty) * 100, 4);
                return (
                  <div key={d.work_date} className="flex-1 flex flex-col items-center">
                    <div className="text-[10px] font-bold mb-0.5">{d.total_qty}</div>
                    <div className="w-full rounded-t" style={{
                      height: `${h}%`,
                      background: "linear-gradient(180deg, #c1440e, #a01a1a)",
                      minHeight: "4px",
                    }} />
                    <div className="text-[9px] text-[#7a6e5e] mt-1">{shortDate(d.work_date)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== ENTRY FORM ========== */}
        <div className="bg-white border border-[#e7ddcd] rounded-2xl p-4">
          <div className="text-xs font-bold text-[#5a5042] uppercase tracking-wide mb-3">
            ➕ Naya kaam / नया काम
          </div>
          <WorkerEntryForm products={productList} />
        </div>

        {/* ========== MY ENTRIES ========== */}
        <div className="bg-white border border-[#e7ddcd] rounded-2xl p-4">
          <div className="text-xs font-bold text-[#5a5042] uppercase tracking-wide mb-3">
            📋 Meri entries / मेरी एंट्री
          </div>
          {L.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-6 text-sm">No entries yet</div>
          ) : (
            <div>
              {L.slice(0, 10).map((l, i) => (
                <div key={i} className="flex justify-between items-center py-2.5 border-b border-[#f2ebdd] last:border-0">
                  <div>
                    <div className="font-bold text-sm">
                      {productList.find(p => p.id === l.product_id)?.name ?? "Product"}
                    </div>
                    <div className="text-[11px] text-[#7a6e5e]">{l.quantity} pcs · {shortDate(l.work_date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif font-bold">{rupee(l.amount_paise)}</div>
                    <StatusPill status={l.status} />
                  </div>
                </div>
              ))}
              {L.length > 10 && (
                <div className="text-center text-xs text-[#7a6e5e] pt-3">
                  +{L.length - 10} aur entries
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[#f5b730]/80 uppercase tracking-wider font-bold">{label}</div>
      <div className="font-serif font-bold text-base mt-0.5">{value}</div>
    </div>
  );
}

function StatCard({ emoji, label, value, sub }: {
  emoji: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-white border border-[#e7ddcd] rounded-2xl p-4 lift">
      <div className="flex items-start justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#7a6e5e]">{label}</div>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-serif text-3xl font-bold">{value}</div>
      <div className="text-[11px] text-[#7a6e5e] mt-0.5">{sub}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = status === "approved" ? "bg-[#e6f2ec] text-brand-green"
    : status === "rejected" ? "bg-[#fbeaea] text-brand-red"
    : "bg-[#fbf1da] text-brand-amber";
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${c}`}>{status}</span>;
}
