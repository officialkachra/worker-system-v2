import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";
import ApprovalActions from "./approval-actions";
import AdminNav from "@/components/admin-nav";
import ChampionCard from "@/components/champion-card";
import TopProductCard from "@/components/top-product-card";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const [workersR, logsR, ledgerR, productsR, weekChampsR, topProductsR] = await Promise.all([
    supabase.from("profiles").select("id,full_name,worker_code").eq("role", "worker"),
    supabase.from("production_logs").select("*").order("work_date", { ascending: false }),
    supabase.from("ledger_entries").select("*"),
    supabase.from("products").select("id,name"),
    supabase.rpc("champions_week"),
    supabase.rpc("product_stats_month"),
  ]);

  const W = workersR.data ?? [];
  const L = (logsR.data ?? []) as (ProductionLog & { id: string })[];
  const Led = (ledgerR.data ?? []) as LedgerEntry[];
  const pname = (id: string) => productsR.data?.find(p => p.id === id)?.name ?? "Product";
  const wname = (id: string) => W.find(w => w.id === id)?.full_name ?? "Worker";

  const pending = L.filter(l => l.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const approvedToday = L.filter(l => l.status === "approved" && l.work_date === today);
  const todayQty = approvedToday.reduce((s, l) => s + l.quantity, 0);
  const totalDue = W.reduce((s, w) => s + duePaise(L, Led, w.id), 0);
  const totalMonthEarned = W.reduce((s, w) => s + earnedPaise(L, w.id, currentYm()), 0);

  const champion = (weekChampsR.data ?? [])[0] ?? null;
  const topProduct = (topProductsR.data ?? []).find((p: any) => p.total_qty > 0) ?? null;

  return (
    <>
      <AdminNav current="/admin" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        {/* Hero section: Champion + Top Product side by side */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="md:col-span-3">
            <ChampionCard champion={champion} periodLabel="Is hafte" emoji="🏆" />
          </div>
          <div className="md:col-span-2">
            <TopProductCard product={topProduct} />
          </div>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Metric label="Aaj banaya" value={String(todayQty)} hint={`${approvedToday.length} entries`} accent emoji="📝" />
          <Metric label="Active workers" value={String(W.length)} hint="kaam kar rahe" emoji="👥" />
          <Metric label="Pending approvals" value={String(pending.length)} hint="dekhna baki" amber emoji="⏳" />
          <Metric label="Is month bana" value={rupee(totalMonthEarned)} hint={`due: ${rupee(totalDue)}`} emoji="💰" />
        </div>

        <Card title={`Pending approvals (${pending.length})`}>
          {pending.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-10 text-sm">
              <div className="text-3xl mb-2">✨</div>
              All caught up — sab approve ho gaya
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>{["Worker","Product","Qty","Amount","Action"].map(h =>
                <th key={h} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
              <tbody>
                {pending.map(l => (
                  <tr key={l.id} className="border-b border-[#f2ebdd] last:border-0 hover:bg-[#fdfaf4]">
                    <td className="px-5 py-2.5">{wname(l.worker_id)}</td>
                    <td className="px-5 py-2.5">{pname(l.product_id)}</td>
                    <td className="px-5 py-2.5">{l.quantity}</td>
                    <td className="px-5 py-2.5 font-serif font-bold">{rupee(l.amount_paise)}</td>
                    <td className="px-5 py-2.5"><ApprovalActions logId={l.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Payroll — month-wise">
          {W.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-8 text-sm">
              No workers yet. Add workers from <span className="text-saffron font-bold">Workers</span> tab.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>{["Worker","Is month","Last month","Advance","Due"].map(h =>
                <th key={h} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
              <tbody>
                {W.map(w => {
                  const due = duePaise(L, Led, w.id);
                  return (
                    <tr key={w.id} className="border-b border-[#f2ebdd] last:border-0 hover:bg-[#fdfaf4]">
                      <td className="px-5 py-2.5">{w.full_name}<div className="text-[11px] text-[#7a6e5e]">{w.worker_code}</div></td>
                      <td className="px-5 py-2.5 font-serif font-bold">{rupee(earnedPaise(L, w.id, currentYm()))}</td>
                      <td className="px-5 py-2.5 font-serif font-bold text-[#7a6e5e]">{rupee(earnedPaise(L, w.id, prevYm()))}</td>
                      <td className="px-5 py-2.5 font-serif font-bold">{rupee(ledgerSum(Led, w.id, "advance"))}</td>
                      <td className={`px-5 py-2.5 font-serif font-bold ${due >= 0 ? "text-brand-green" : "text-brand-red"}`}>{rupee(due)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function Metric({ label, value, hint, accent, amber, emoji }: any) {
  return (
    <div className={`bg-white border border-[#e7ddcd] rounded-xl p-4 lift ${accent ? "border-t-2 border-t-saffron" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] text-[#7a6e5e] uppercase font-bold tracking-wide">{label}</div>
        <span className="text-lg opacity-60">{emoji}</span>
      </div>
      <div className={`font-serif text-2xl font-bold ${amber ? "text-brand-amber" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-[#7a6e5e] mt-0.5">{hint}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#e7ddcd] rounded-2xl mb-5 overflow-hidden shadow-sm">
      <h2 className="text-[15px] font-bold px-5 py-3.5 border-b border-[#e7ddcd]">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
