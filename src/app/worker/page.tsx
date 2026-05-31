import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import {
  rupee, earnedPaise, ledgerSum, duePaise, currentYm, prevYm,
  type ProductionLog, type LedgerEntry,
} from "@/lib/payroll";
import WorkerEntryForm from "./entry-form";
import LogoutButton from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function WorkerHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();

  // RLS guarantees these only return THIS worker's rows.
  const { data: logs } = await supabase
    .from("production_logs").select("*").order("work_date", { ascending: false });
  const { data: ledger } = await supabase.from("ledger_entries").select("*");
  const { data: products } = await supabase
    .from("products").select("id,name").eq("is_active", true);
  const { data: rates } = await supabase
    .from("product_rates").select("product_id,rate_paise,effective_from");

  const L = (logs ?? []) as ProductionLog[];
  const Led = (ledger ?? []) as LedgerEntry[];
  const wid = user.id;

  const cur = earnedPaise(L, wid, currentYm());
  const prev = earnedPaise(L, wid, prevYm());
  const advance = ledgerSum(Led, wid, "advance");
  const due = duePaise(L, Led, wid);

  // latest rate per product (snapshot logic happens server-side in submit_production)
  const rateMap = new Map<string, number>();
  (rates ?? [])
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    .forEach(r => rateMap.set(r.product_id, r.rate_paise));
  const productList = (products ?? []).map(p => ({
    id: p.id, name: p.name, rate: rateMap.get(p.id) ?? 0,
  }));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white">
      <div className="bg-ink text-[#f4ede0] px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-[#c9bba6]">नमस्ते 🙏</div>
          <div className="font-serif text-xl font-bold">{me?.full_name}</div>
        </div>
        <LogoutButton />
      </div>

      <div className="p-5">
        <div className="bg-[#fbeee7] border border-[#f0d2c0] rounded-xl p-4 text-center mb-4">
          <div className="text-xs text-saffron font-bold uppercase tracking-wide">
            Pending balance / बकाया
          </div>
          <div className="font-serif text-4xl font-bold text-saffron">{rupee(due)}</div>
          <div className="flex justify-around mt-3 pt-3 border-t border-dashed border-[#e8c9b6]">
            <Stat label="Is month" value={rupee(cur)} />
            <Stat label="Last month" value={rupee(prev)} />
            <Stat label="Advance" value={rupee(advance)} />
          </div>
        </div>

        <WorkerEntryForm products={productList} />

        <div className="mt-6 font-bold text-xs text-[#5a5042] uppercase">
          My entries / मेरी एंट्री
        </div>
        <div>
          {L.length === 0 && (
            <div className="text-center text-[#7a6e5e] py-8 text-sm">No entries yet</div>
          )}
          {L.map((l, i) => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-[#f2ebdd]">
              <div>
                <div className="font-bold text-sm">
                  {productList.find(p => p.id === l.product_id)?.name ?? "Product"}
                </div>
                <div className="text-xs text-[#7a6e5e]">
                  {l.quantity} pcs · {l.work_date}
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif font-bold">{rupee(l.amount_paise)}</div>
                <StatusPill status={l.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-[#7a6e5e]">{label}</div>
      <div className="font-serif font-bold text-[15px]">{value}</div>
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const c = status === "approved" ? "bg-[#e6f2ec] text-brand-green"
    : status === "rejected" ? "bg-[#fbeaea] text-brand-red"
    : "bg-[#fbf1da] text-brand-amber";
  return <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${c}`}>{status}</span>;
}
