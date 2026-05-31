import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import AddWorkerButton from "./add-worker-button";
import WorkerRowActions from "./worker-row-actions";
import { rupee, daysInCurrentMonth } from "@/lib/payroll";

export const dynamic = "force-dynamic";

type MonthChamp = {
  worker_id: string; full_name: string; worker_code: string;
  total_paise: number; total_qty: number; days_worked: number; rank: number;
};

export default async function WorkersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [wkR, monthR] = await Promise.all([
    supabase.from("profiles")
      .select("id,full_name,worker_code,phone,is_active,joining_date")
      .eq("role", "worker").order("worker_code", { ascending: true }),
    supabase.rpc("champions_month"),
  ]);

  const W = wkR.data ?? [];
  const champs = (monthR.data ?? []) as MonthChamp[];
  const rankMap = new Map(champs.map(c => [c.worker_id, c]));
  const monthDays = daysInCurrentMonth();

  return (
    <>
      <AdminNav current="/admin/workers" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-white border border-[#e7ddcd] rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e7ddcd]">
            <h2 className="text-[15px] font-bold">Workers ({W.length})</h2>
            <AddWorkerButton />
          </div>
          {W.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-12 text-sm">
              <div className="text-3xl mb-2 opacity-40">👥</div>
              <p className="mb-2">Abhi koi worker nahi hai.</p>
              <p className="text-xs">Upar &quot;+ Add worker&quot; dabake pehla worker banao.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Rank","Code","Name","This month","Days worked","Status",""].map((h,i)=>
                  <th key={i} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {W.map(w => {
                    const c = rankMap.get(w.id);
                    return (
                      <tr key={w.id} className="border-b border-[#f2ebdd] last:border-0 hover:bg-[#fdfaf4]">
                        <td className="px-5 py-3">{c ? <RankBadge rank={c.rank} /> : <span className="text-xs text-[#7a6e5e]">—</span>}</td>
                        <td className="px-5 py-3 font-bold font-mono text-xs">{w.worker_code}</td>
                        <td className="px-5 py-3">
                          <div>{w.full_name}</div>
                          {w.phone && <div className="text-[11px] text-[#7a6e5e]">{w.phone}</div>}
                        </td>
                        <td className="px-5 py-3 font-serif font-bold">{c ? rupee(Number(c.total_paise)) : "—"}</td>
                        <td className="px-5 py-3">
                          {c ? <DaysBadge days={c.days_worked} total={monthDays} /> : <span className="text-xs text-[#7a6e5e]">0 din</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            w.is_active ? "bg-[#e6f2ec] text-brand-green" : "bg-[#fbeaea] text-brand-red"
                          }`}>{w.is_active ? "active" : "inactive"}</span>
                        </td>
                        <td className="px-5 py-3">
                          <WorkerRowActions workerId={w.id} isActive={w.is_active} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-gradient-to-br from-[#ffd770] to-[#b8860b] text-white",
    2: "bg-gradient-to-br from-[#d4d4d4] to-[#8a8a8a] text-white",
    3: "bg-gradient-to-br from-[#d99860] to-[#8c5a2a] text-white",
  };
  const cls = colors[rank] ?? "bg-[#f2ebdd] text-[#5a5042]";
  return (
    <div className={`${cls} rounded-full w-8 h-8 font-bold flex items-center justify-center font-serif text-xs`}>
      #{rank}
    </div>
  );
}

function DaysBadge({ days, total }: { days: number; total: number }) {
  const pct = (days / total) * 100;
  const emoji = days >= 20 ? "🔥" : days >= 10 ? "⭐" : days >= 5 ? "✓" : "";
  return (
    <div className="flex items-center gap-2">
      <span className="font-serif font-bold">{days}<span className="text-xs font-normal text-[#7a6e5e]">/{total}</span></span>
      {emoji && <span className="text-base">{emoji}</span>}
      <div className="w-14 h-1.5 bg-[#f2ebdd] rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald to-[#2a8c6a]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
