import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin-nav";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: workers } = await supabase
    .from("profiles").select("id,full_name,worker_code,is_active").eq("role", "worker");
  const { data: logs } = await supabase.from("production_logs").select("*");
  const { data: ledger } = await supabase.from("ledger_entries").select("*");

  const W = workers ?? [];
  const L = (logs ?? []) as ProductionLog[];
  const Led = (ledger ?? []) as LedgerEntry[];

  const totalDue = W.reduce((s, w) => s + duePaise(L, Led, w.id), 0);
  const totalCurMonth = W.reduce((s, w) => s + earnedPaise(L, w.id, currentYm()), 0);
  const totalPaidMonth = W.reduce((s, w) => {
    return s + Led.filter(e =>
      e.worker_id === w.id && e.kind === "payment" &&
      e.created_at.slice(0,7) === currentYm()
    ).reduce((x, e) => x + e.debit_paise, 0);
  }, 0);

  return (
    <>
      <AdminNav current="/admin/payroll" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Card label="Is month bana — sab workers" value={rupee(totalCurMonth)} accent />
          <Card label="Is month paid — sab workers" value={rupee(totalPaidMonth)} />
          <Card label="Total due — sab workers" value={rupee(totalDue)} amber />
        </div>

        <div className="bg-white border border-[#e7ddcd] rounded-xl overflow-hidden">
          <h2 className="text-[15px] font-bold px-5 py-3.5 border-b border-[#e7ddcd]">
            Workers — month-wise breakdown
          </h2>
          {W.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-12 text-sm">
              Abhi koi worker nahi. <Link href="/admin/workers" className="text-saffron font-bold">Workers tab</Link> mein ja ke add karo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Worker","Is month","Last month","Advance","Bonus","Penalty","Paid","Due",""].map((h,i)=>
                  <th key={i} className="text-left px-4 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {W.map(w => {
                    const due = duePaise(L, Led, w.id);
                    const cur = earnedPaise(L, w.id, currentYm());
                    const prev = earnedPaise(L, w.id, prevYm());
                    const adv = ledgerSum(Led, w.id, "advance");
                    const bon = ledgerSum(Led, w.id, "bonus");
                    const pen = ledgerSum(Led, w.id, "penalty");
                    const pay = ledgerSum(Led, w.id, "payment");
                    return (
                      <tr key={w.id} className="border-b border-[#f2ebdd] last:border-0">
                        <td className="px-4 py-3">
                          {w.full_name}
                          <div className="text-[11px] text-[#7a6e5e]">{w.worker_code}</div>
                        </td>
                        <td className="px-4 py-3 font-serif font-bold">{rupee(cur)}</td>
                        <td className="px-4 py-3 font-serif font-bold text-[#7a6e5e]">{rupee(prev)}</td>
                        <td className="px-4 py-3 font-serif">{rupee(adv)}</td>
                        <td className="px-4 py-3 font-serif text-brand-green">{rupee(bon)}</td>
                        <td className="px-4 py-3 font-serif text-brand-red">{rupee(pen)}</td>
                        <td className="px-4 py-3 font-serif">{rupee(pay)}</td>
                        <td className={`px-4 py-3 font-serif font-bold ${due >= 0 ? "text-brand-green" : "text-brand-red"}`}>{rupee(due)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/workers/${w.id}`}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#e7ddcd] hover:bg-[#faf6ef]">
                            Statement
                          </Link>
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

function Card({ label, value, accent, amber }: any) {
  return (
    <div className={`bg-white border border-[#e7ddcd] rounded-xl p-4 ${accent ? "border-t-2 border-t-saffron" : ""}`}>
      <div className="text-[11px] text-[#7a6e5e] uppercase font-bold tracking-wide">{label}</div>
      <div className={`font-serif text-2xl font-bold mt-1 ${amber ? "text-brand-amber" : ""}`}>{value}</div>
    </div>
  );
}
