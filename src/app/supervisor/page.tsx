import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { type ProductionLog } from "@/lib/payroll";
import ApprovalActions from "../admin/approval-actions";
import LogoutButton from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function SupervisorHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "supervisor" && profile?.role !== "admin") redirect("/");

  const { data: workers } = await supabase
    .from("profiles").select("id,full_name").eq("role", "worker");
  const { data: logs } = await supabase
    .from("production_logs").select("*").order("work_date", { ascending: false });
  const { data: products } = await supabase.from("products").select("id,name");

  const L = (logs ?? []) as (ProductionLog & { id: string })[];
  const pending = L.filter(l => l.status === "pending");
  const pname = (id: string) => products?.find(p => p.id === id)?.name ?? "Product";
  const wname = (id: string) => workers?.find(w => w.id === id)?.full_name ?? "Worker";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold">Supervisor</h1>
          <p className="text-sm text-[#7a6e5e]">{profile.full_name} · approvals & reports</p>
        </div>
        <LogoutButton />
      </div>

      <div className="bg-white border border-[#e7ddcd] rounded-xl overflow-hidden">
        <h2 className="text-[15px] font-bold px-5 py-3.5 border-b border-[#e7ddcd]">
          Pending approvals ({pending.length})
        </h2>
        <div className="overflow-x-auto">
          {pending.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-8 text-sm">All caught up 🎉</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Worker", "Product", "Qty", "Date", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map(l => (
                  <tr key={l.id} className="border-b border-[#f2ebdd] last:border-0">
                    <td className="px-5 py-2.5">{wname(l.worker_id)}</td>
                    <td className="px-5 py-2.5">{pname(l.product_id)}</td>
                    <td className="px-5 py-2.5">{l.quantity}</td>
                    <td className="px-5 py-2.5">{l.work_date}</td>
                    <td className="px-5 py-2.5"><ApprovalActions logId={l.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
