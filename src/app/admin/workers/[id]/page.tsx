import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin-nav";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm, parseDateRange,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";
import StatementActions from "./statement-actions";
import ReverseLedgerBtn from "./reverse-ledger-btn";
import ReverseLogBtn from "./reverse-log-btn";
import DateRangeFilter from "@/components/date-range-filter";
import ResetPasswordButton from "./reset-password-button";

export const dynamic = "force-dynamic";

export default async function WorkerStatement({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: { preset?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const wid = params.id;
  const { data: worker } = await supabase
    .from("profiles").select("id,full_name,worker_code,phone,is_active")
    .eq("id", wid).single();
  if (!worker) redirect("/admin/workers");

  const range = parseDateRange(searchParams.preset, searchParams.from, searchParams.to);

  // Full data for top-level stats (Is month / Last month / Advance / Due)
  const { data: logs } = await supabase
    .from("production_logs").select("*")
    .eq("worker_id", wid).order("work_date", { ascending: false });
  const { data: ledger } = await supabase
    .from("ledger_entries").select("*")
    .eq("worker_id", wid).order("created_at", { ascending: false });
  const { data: products } = await supabase.from("products").select("id,name");

  const L = (logs ?? []) as (ProductionLog & { id: string })[];
  const Led = (ledger ?? []) as (LedgerEntry & { id: string })[];
  const pname = (id: string) => products?.find(p => p.id === id)?.name ?? "Product";

  const cur = earnedPaise(L, wid, currentYm());
  const prev = earnedPaise(L, wid, prevYm());
  const adv = ledgerSum(Led, wid, "advance");
  const bonus = ledgerSum(Led, wid, "bonus");
  const penalty = ledgerSum(Led, wid, "penalty");
  const paid = ledgerSum(Led, wid, "payment");
  const due = duePaise(L, Led, wid);

  // Combined timeline: earnings (from approved logs) + ledger entries.
  type Row = { date: string; desc: string; cr: number; dr: number; tag: string; id: string; canReverse: boolean };
  const allRows: Row[] = [
    ...L.filter(l => l.status === "approved").map(l => ({
      date: l.work_date,
      desc: `${pname(l.product_id)} × ${l.quantity}`,
      cr: l.amount_paise, dr: 0,
      tag: "earning",
      id: l.id, canReverse: true,
    })),
    ...Led.map(e => ({
      date: e.created_at.slice(0, 10),
      desc: e.description || e.kind,
      cr: e.credit_paise, dr: e.debit_paise,
      tag: e.kind,
      id: e.id,
      canReverse: e.kind !== "earning" && e.kind !== "reversal",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Filter to selected date range for the ledger view
  const rows = allRows.filter(r => r.date >= range.from && r.date <= range.to);

  return (
    <>
      <AdminNav current="/admin/workers" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <Link href="/admin/workers" className="text-sm text-saffron font-bold mb-3 inline-block">
          ← Workers list
        </Link>

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-serif text-2xl font-bold">{worker.full_name}</h2>
            <p className="text-sm text-[#7a6e5e]">{worker.worker_code} · {worker.phone ?? "no phone"}</p>
          </div>
          <div className="flex gap-2 items-center">
            <ResetPasswordButton workerId={wid} workerName={worker.full_name} workerCode={worker.worker_code ?? ""} />
            <StatementActions workerId={wid} workerName={worker.full_name} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Is month bana" value={rupee(cur)} hint="May 2026" accent />
          <Stat label="Last month bana" value={rupee(prev)} hint="April 2026" muted />
          <Stat label="Advance diya" value={rupee(adv)} hint="paisa pehle diya" />
          <Stat label="Total gaya" value={rupee(paid + adv)} hint="paid + advance" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Stat label="Bonus" value={rupee(bonus)} hint="extra credit" />
          <Stat label="Penalty" value={rupee(penalty)} hint="extra debit" red />
          <Stat label="Baaki due" value={rupee(due)} hint="dena hai"
            color={due >= 0 ? "green" : "red"} />
        </div>

        <div className="bg-white border border-[#e7ddcd] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e7ddcd] flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold">Ledger — {range.label}</h2>
            <DateRangeFilter defaultPreset="month" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Date","Description","Credit (+)","Debit (−)","Type",""].map((h,i)=>
                <th key={i} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-[#7a6e5e] py-8 text-sm">Abhi koi transaction nahi</td></tr>
                ) : rows.map((r,i) => (
                  <tr key={r.tag + "-" + r.id + "-" + i} className="border-b border-[#f2ebdd] last:border-0">
                    <td className="px-5 py-2.5 text-[#7a6e5e]">{r.date}</td>
                    <td className="px-5 py-2.5">{r.desc}</td>
                    <td className="px-5 py-2.5 font-serif font-bold text-brand-green">{r.cr ? rupee(r.cr) : ""}</td>
                    <td className="px-5 py-2.5 font-serif font-bold text-brand-red">{r.dr ? rupee(r.dr) : ""}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        r.tag === "earning" || r.tag === "bonus" ? "bg-[#e6f2ec] text-brand-green" :
                        r.tag === "penalty" || r.tag === "reversal" ? "bg-[#fbeaea] text-brand-red" :
                        "bg-[#fbf1da] text-brand-amber"
                      }`}>{r.tag}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      {r.canReverse && (r.tag === "payment" || r.tag === "advance" || r.tag === "bonus" || r.tag === "penalty") && (
                        <ReverseLedgerBtn entryId={r.id} />
                      )}
                      {r.tag === "earning" && (
                        <ReverseLogBtn logId={r.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint, accent, muted, red, color }: any) {
  const valueColor = color === "green" ? "text-brand-green" : color === "red" ? "text-brand-red" : "";
  return (
    <div className={`bg-white border border-[#e7ddcd] rounded-xl p-4 ${accent ? "border-t-2 border-t-saffron" : ""}`}>
      <div className="text-[11px] text-[#7a6e5e] uppercase font-bold tracking-wide">{label}</div>
      <div className={`font-serif text-xl font-bold mt-1 ${muted ? "text-[#7a6e5e]" : ""} ${red ? "text-brand-red" : ""} ${valueColor}`}>{value}</div>
      {hint && <div className="text-xs text-[#7a6e5e] mt-0.5">{hint}</div>}
    </div>
  );
}
