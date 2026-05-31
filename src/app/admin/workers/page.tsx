import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import AddWorkerButton from "./add-worker-button";
import WorkerRowActions from "./worker-row-actions";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: workers } = await supabase
    .from("profiles")
    .select("id,full_name,worker_code,phone,is_active,joining_date")
    .eq("role", "worker")
    .order("worker_code", { ascending: true });

  const W = workers ?? [];

  return (
    <>
      <AdminNav current="/admin/workers" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-white border border-[#e7ddcd] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e7ddcd]">
            <h2 className="text-[15px] font-bold">Workers ({W.length})</h2>
            <AddWorkerButton />
          </div>
          {W.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-12 text-sm">
              <p className="mb-2">Abhi koi worker nahi hai.</p>
              <p className="text-xs">Upar &quot;+ Add worker&quot; dabake pehla worker banao.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Code","Name","Phone","Joining","Status",""].map((h,i)=>
                  <th key={i} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {W.map(w => (
                    <tr key={w.id} className="border-b border-[#f2ebdd] last:border-0">
                      <td className="px-5 py-3 font-bold">{w.worker_code}</td>
                      <td className="px-5 py-3">{w.full_name}</td>
                      <td className="px-5 py-3 text-[#7a6e5e]">{w.phone ?? "—"}</td>
                      <td className="px-5 py-3 text-[#7a6e5e]">{w.joining_date ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          w.is_active ? "bg-[#e6f2ec] text-brand-green" : "bg-[#fbeaea] text-brand-red"
                        }`}>{w.is_active ? "active" : "inactive"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <WorkerRowActions workerId={w.id} isActive={w.is_active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
