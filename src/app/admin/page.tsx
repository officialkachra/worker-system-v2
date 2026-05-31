import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";
import ApprovalActions from "./approval-actions";
import LogoutButton from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: workers } = await supabase
    .from("profiles").select("id,full_name,worker_code").eq("role", "worker");
  const { data: logs } = await supabase
    .from("production_logs").select("*").order("work_date", { ascending: false });
  const { data: ledger } = await supabase.from("ledger_entries").select("*");
  const { data: products } = await supabase.from("products").select("id,name");

  const W = workers ?? [];
  const L = (logs ?? []) as (ProductionLog & { id: string })[];
  const Led = (ledger ?? []) as LedgerEntry[];
  const pname = (id: string) => products?.find(p => p.id === id)?.name ?? "Product";
  const wname = (id: string) => W.find(w => w.id === id)?.full_name ?? "Worker";

  const pending = L.filter(l => l.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const approvedToday = L.filter(l => l.status === "approved" && l.work_date === today);
  const todayQty = approvedToday.reduce((s, l) => s + l.quantity, 0);
  const totalDue = W.reduce((s, w) => s + duePaise(L, Led, w.id), 0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-[#7a6e5e]">{profile.full_name} · Jaipur workshop</p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metric label="Approved today" value={String(todayQty)} hint={`${approvedToday.length} entries`} accent />
        <Metric label="Active workers" value={String(W.length)} hint="workers" />
        <Metric label="Pending approvals" value={String(pending.length)} hint="awaiting review" amber />
        <Metric label="Total dues" value={rupee(totalDue)} hint="unpaid" />
      </div>

      <Card title={`Pending approvals (${pending.length})`}>
        {pending.length === 0 ? (
          <Empty>All caught up 🎉</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead><Tr head><Th>Worker</Th><Th>Product</Th><Th>Qty</Th><Th>Amount</Th><Th>Action</Th></Tr></thead>
            <tbody>
              {pending.map(l => (
                <Tr key={l.id}>
                  <Td>{wname(l.worker_id)}</Td>
                  <Td>{pname(l.product_id)}</Td>
                  <Td>{l.quantity}</Td>
                  <Td mono>{rupee(l.amount_paise)}</Td>
                  <Td><ApprovalActions logId={l.id} /></Td>
                </Tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Payroll — month-wise">
        <table className="w-full text-sm">
          <thead><Tr head>
            <Th>Worker</Th><Th>Is month</Th><Th>Last month</Th><Th>Advance</Th><Th>Due</Th>
          </Tr></thead>
          <tbody>
            {W.map(w => {
              const due = duePaise(L, Led, w.id);
              return (
                <Tr key={w.id}>
                  <Td>{w.full_name}<div className="text-[11px] text-[#7a6e5e]">{w.worker_code}</div></Td>
                  <Td mono>{rupee(earnedPaise(L, w.id, currentYm()))}</Td>
                  <Td mono className="text-[#7a6e5e]">{rupee(earnedPaise(L, w.id, prevYm()))}</Td>
                  <Td mono>{rupee(ledgerSum(Led, w.id, "advance"))}</Td>
                  <Td mono className={due >= 0 ? "text-brand-green font-bold" : "text-brand-red font-bold"}>
                    {rupee(due)}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Metric({ label, value, hint, accent, amber }: {
  label: string; value: string; hint?: string; accent?: boolean; amber?: boolean;
}) {
  return (
    <div className={`bg-white border border-[#e7ddcd] rounded-xl p-4 ${accent ? "border-t-2 border-t-saffron" : ""}`}>
      <div className="text-[11px] text-[#7a6e5e] uppercase font-bold tracking-wide">{label}</div>
      <div className={`font-serif text-2xl font-bold mt-1 ${amber ? "text-brand-amber" : ""}`}>{value}</div>
      {hint && <div className="text-xs text-[#7a6e5e] mt-0.5">{hint}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#e7ddcd] rounded-xl mb-5 overflow-hidden">
      <h2 className="text-[15px] font-bold px-5 py-3.5 border-b border-[#e7ddcd]">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
const Empty = ({ children }: { children: React.ReactNode }) =>
  <div className="text-center text-[#7a6e5e] py-8 text-sm">{children}</div>;
const Tr = ({ children, head }: { children: React.ReactNode; head?: boolean }) =>
  <tr className={head ? "" : "border-b border-[#f2ebdd] last:border-0"}>{children}</tr>;
const Th = ({ children }: { children: React.ReactNode }) =>
  <th className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{children}</th>;
const Td = ({ children, mono, className = "" }: { children: React.ReactNode; mono?: boolean; className?: string }) =>
  <td className={`px-5 py-2.5 ${mono ? "font-serif font-bold" : ""} ${className}`}>{children}</td>;
