import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import { rupee, shortDate, daysInCurrentMonth } from "@/lib/payroll";

export const dynamic = "force-dynamic";

type MonthChamp = {
  worker_id: string; full_name: string; worker_code: string;
  total_paise: number; total_qty: number; days_worked: number; rank: number;
};
type ProductStat = {
  product_id: string; product_name: string; sku: string | null;
  total_qty: number; total_paise: number; worker_count: number; rank: number;
};
type DailyProd = { work_date: string; total_qty: number; total_paise: number };

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [monthR, weekR, prodR, dailyR] = await Promise.all([
    supabase.rpc("champions_month"),
    supabase.rpc("champions_week"),
    supabase.rpc("product_stats_month"),
    supabase.rpc("daily_production", { p_days: 7 }),
  ]);

  const monthChamps = (monthR.data ?? []) as MonthChamp[];
  const weekChamps = (weekR.data ?? []) as MonthChamp[];
  const products = (prodR.data ?? []) as ProductStat[];
  const daily = (dailyR.data ?? []) as DailyProd[];

  const top3 = monthChamps.slice(0, 3);
  const rest = monthChamps.slice(3);
  const monthName = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const maxDailyQty = Math.max(...daily.map(d => Number(d.total_qty)), 1);
  const monthDays = daysInCurrentMonth();

  return (
    <>
      <AdminNav current="/admin/analytics" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="font-serif text-2xl font-bold">Analytics</h2>
            <p className="text-sm text-[#7a6e5e]">{monthName} · workshop performance</p>
          </div>
        </div>

        {/* ========== TOP 3 PODIUM ========== */}
        <div className="relative overflow-hidden rounded-2xl mb-6 p-6"
          style={{
            background: "linear-gradient(135deg, #fbeee7 0%, #fbf3df 60%, #fbeee7 100%)",
          }}>
          <div className="absolute top-3 right-5 text-[#b8860b] opacity-20 text-3xl">✦</div>
          <div className="absolute bottom-3 left-5 text-[#c1440e] opacity-20 text-3xl">✦</div>

          <h3 className="font-serif text-xl font-bold mb-1 text-center">🏆 Month ke Champions</h3>
          <p className="text-xs text-center text-[#7a6e5e] mb-6">Approved earnings ke hisaab se</p>

          {top3.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-6 text-sm">
              Abhi koi approved entry nahi. Workers ko entries karne do, phir podium yahaan dikhega.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto items-end">
              {/* Position 2 (Silver) */}
              <PodiumStep champ={top3[1]} place={2} height="h-32"
                bg="from-[#d4d4d4] to-[#8a8a8a]" medal="🥈" />
              {/* Position 1 (Gold) — center, tallest */}
              <PodiumStep champ={top3[0]} place={1} height="h-44"
                bg="from-[#ffd770] to-[#b8860b]" medal="🥇" />
              {/* Position 3 (Bronze) */}
              <PodiumStep champ={top3[2]} place={3} height="h-24"
                bg="from-[#d99860] to-[#8c5a2a]" medal="🥉" />
            </div>
          )}
        </div>

        {/* ========== FULL LEADERBOARD ========== */}
        {monthChamps.length > 0 && (
          <div className="bg-white border border-[#e7ddcd] rounded-2xl mb-6 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e7ddcd] flex items-center justify-between">
              <h3 className="font-bold">Full leaderboard — is month</h3>
              <span className="text-[11px] text-[#7a6e5e]">{monthChamps.length} workers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["#","Worker","Kamai","Banaya","Din kaam kiya","Streak"].map(h =>
                  <th key={h} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {monthChamps.map(c => (
                    <tr key={c.worker_id} className="border-b border-[#f2ebdd] last:border-0 hover:bg-[#fdfaf4]">
                      <td className="px-5 py-3">
                        <RankBadge rank={c.rank} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-bold">{c.full_name}</div>
                        <div className="text-[11px] text-[#7a6e5e] font-mono">{c.worker_code}</div>
                      </td>
                      <td className="px-5 py-3 font-serif font-bold">{rupee(Number(c.total_paise))}</td>
                      <td className="px-5 py-3 font-serif">{c.total_qty} <span className="text-xs text-[#7a6e5e]">pcs</span></td>
                      <td className="px-5 py-3">
                        <DaysWorkedBadge days={c.days_worked} totalDays={monthDays} />
                      </td>
                      <td className="px-5 py-3">
                        <StreakBadge days={c.days_worked} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== WEEKLY TREND BAR CHART ========== */}
        <div className="bg-white border border-[#e7ddcd] rounded-2xl mb-6 overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-[#e7ddcd]">
            <h3 className="font-bold">📈 Last 7 din ka kaam</h3>
            <p className="text-[11px] text-[#7a6e5e] mt-0.5">Daily approved pieces</p>
          </div>
          <div className="p-6">
            {daily.length === 0 ? (
              <div className="text-center text-[#7a6e5e] py-6 text-sm">Abhi koi data nahi</div>
            ) : (
              <div className="flex items-end gap-3 h-40">
                {daily.map(d => {
                  const h = Math.max((Number(d.total_qty) / maxDailyQty) * 100, 3);
                  return (
                    <div key={d.work_date} className="flex-1 flex flex-col items-center group">
                      <div className="text-[11px] font-bold text-[#5a5042] mb-1">{d.total_qty}</div>
                      <div className="w-full rounded-t-md transition-all hover:opacity-80"
                        style={{
                          height: `${h}%`,
                          background: "linear-gradient(180deg, #c1440e 0%, #a01a1a 100%)",
                          minHeight: "6px",
                        }}
                        title={`${rupee(Number(d.total_paise))}`} />
                      <div className="text-[10px] text-[#7a6e5e] mt-2 whitespace-nowrap">{shortDate(d.work_date)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========== PRODUCT-WISE BREAKDOWN ========== */}
        <div className="bg-white border border-[#e7ddcd] rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-[#e7ddcd]">
            <h3 className="font-bold">📿 Product-wise — is month</h3>
            <p className="text-[11px] text-[#7a6e5e] mt-0.5">Kaunsa product zyada bana, kaunsa kam</p>
          </div>
          {products.length === 0 || products.every(p => p.total_qty == 0) ? (
            <div className="text-center text-[#7a6e5e] py-10 text-sm">
              <div className="text-3xl mb-2 opacity-40">📖</div>
              Is month koi product banaya nahi gaya
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Rank","Product","SKU","Banaya","Revenue","Workers"].map(h =>
                  <th key={h} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {products.map(p => {
                    const isTop = p.rank === 1 && Number(p.total_qty) > 0;
                    const pct = (Number(p.total_qty) / Math.max(...products.map(x => Number(x.total_qty)), 1)) * 100;
                    return (
                      <tr key={p.product_id} className={`border-b border-[#f2ebdd] last:border-0 ${isTop ? "bg-[#fbf3df]/40" : ""}`}>
                        <td className="px-5 py-3">
                          <RankBadge rank={p.rank} small />
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isTop && <span className="text-base">🥇</span>}
                            <span className="font-bold">{p.product_name}</span>
                          </div>
                          {/* mini bar */}
                          <div className="mt-1.5 h-1 bg-[#f2ebdd] rounded-full overflow-hidden w-32">
                            <div className="h-full rounded-full" style={{
                              width: `${pct}%`,
                              background: isTop ? "linear-gradient(90deg, #f5b730, #b8860b)" : "#c1440e",
                            }} />
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-[#7a6e5e]">{p.sku ?? "—"}</td>
                        <td className="px-5 py-3 font-serif font-bold text-base">{p.total_qty} <span className="text-xs font-normal text-[#7a6e5e]">pcs</span></td>
                        <td className="px-5 py-3 font-serif font-bold">{rupee(Number(p.total_paise))}</td>
                        <td className="px-5 py-3">{p.worker_count > 0 ? `${p.worker_count} workers` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ========== WEEK CHAMPIONS (compact) ========== */}
        {weekChamps.length > 0 && (
          <div className="bg-white border border-[#e7ddcd] rounded-2xl mt-6 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#e7ddcd]">
              <h3 className="font-bold">⚡ Last 7 din — top earners</h3>
            </div>
            <div className="divide-y divide-[#f2ebdd]">
              {weekChamps.slice(0, 5).map((c, i) => (
                <div key={c.worker_id} className="flex items-center px-5 py-3 hover:bg-[#fdfaf4]">
                  <RankBadge rank={c.rank} small />
                  <div className="flex-1 ml-3">
                    <div className="font-bold">{c.full_name}</div>
                    <div className="text-[11px] text-[#7a6e5e] font-mono">{c.worker_code}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif font-bold">{rupee(Number(c.total_paise))}</div>
                    <div className="text-[11px] text-[#7a6e5e]">{c.total_qty} pcs</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PodiumStep({ champ, place, height, bg, medal }: {
  champ: MonthChamp | undefined;
  place: number; height: string; bg: string; medal: string;
}) {
  if (!champ) {
    return (
      <div className="flex flex-col items-center">
        <div className="text-3xl opacity-30 mb-2">{medal}</div>
        <div className={`w-full ${height} rounded-t-lg bg-[#e7ddcd]/40 flex items-center justify-center font-serif text-2xl font-bold text-[#a89881]`}>
          {place}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center animate-fade-in-up" style={{ animationDelay: `${place * 80}ms` }}>
      <div className={`text-4xl mb-2 ${place === 1 ? "animate-trophy-bounce" : ""}`}>{medal}</div>
      <div className="text-center mb-2">
        <div className="font-bold text-sm leading-tight">{champ.full_name}</div>
        <div className="text-[10px] text-[#7a6e5e] font-mono">{champ.worker_code}</div>
        <div className="font-serif font-bold text-sm mt-0.5">{rupee(Number(champ.total_paise))}</div>
      </div>
      <div className={`w-full ${height} rounded-t-lg flex items-center justify-center font-serif text-3xl font-bold text-white shadow-md bg-gradient-to-b ${bg}`}>
        {place}
      </div>
    </div>
  );
}

function RankBadge({ rank, small }: { rank: number; small?: boolean }) {
  const colors: Record<number, string> = {
    1: "bg-gradient-to-br from-[#ffd770] to-[#b8860b] text-white",
    2: "bg-gradient-to-br from-[#d4d4d4] to-[#8a8a8a] text-white",
    3: "bg-gradient-to-br from-[#d99860] to-[#8c5a2a] text-white",
  };
  const cls = colors[rank] ?? "bg-[#f2ebdd] text-[#5a5042]";
  return (
    <div className={`${cls} rounded-full font-bold flex items-center justify-center font-serif ${small ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"}`}>
      #{rank}
    </div>
  );
}

function DaysWorkedBadge({ days, totalDays }: { days: number; totalDays: number }) {
  const pct = (days / totalDays) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="font-serif font-bold">{days}<span className="text-xs font-normal text-[#7a6e5e]">/{totalDays}</span></div>
      <div className="w-16 h-1.5 bg-[#f2ebdd] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald to-[#2a8c6a]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StreakBadge({ days }: { days: number }) {
  if (days >= 20) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[#fbeee7] text-saffron">🔥 {days} din</span>;
  if (days >= 10) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[#fbf3df] text-brand-amber">⭐ {days} din</span>;
  if (days >= 5) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[#e6f2ec] text-brand-green">✓ {days} din</span>;
  return <span className="text-xs text-[#7a6e5e]">{days} din</span>;
}
