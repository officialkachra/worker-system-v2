import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin-nav";
import { rupee } from "@/lib/payroll";
import AddProductButton from "./add-product-button";
import ProductRowActions from "./product-row-actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: products } = await supabase
    .from("products").select("id,name,sku,is_active,qc_required").order("name");
  const { data: rates } = await supabase
    .from("product_rates").select("product_id,rate_paise,effective_from")
    .order("effective_from", { ascending: false });

  // current rate = latest per product
  const currentRate = new Map<string, number>();
  for (const r of rates ?? []) {
    if (!currentRate.has(r.product_id)) currentRate.set(r.product_id, r.rate_paise);
  }

  const P = products ?? [];

  return (
    <>
      <AdminNav current="/admin/products" adminName={profile.full_name} />
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-white border border-[#e7ddcd] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e7ddcd]">
            <div>
              <h2 className="text-[15px] font-bold">Products ({P.length})</h2>
              <p className="text-[11px] text-[#7a6e5e]">Rate change karne se purane approved kaam ka paisa nahi badlega (rate snapshot hota hai).</p>
            </div>
            <AddProductButton />
          </div>
          {P.length === 0 ? (
            <div className="text-center text-[#7a6e5e] py-12 text-sm">
              Abhi koi product nahi. + Add product dabake banao.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["SKU","Name","Current rate","QC","Status",""].map((h,i)=>
                  <th key={i} className="text-left px-5 py-2.5 text-[11px] text-[#7a6e5e] uppercase tracking-wide border-b border-[#e7ddcd]">{h}</th>)}</tr></thead>
                <tbody>
                  {P.map(p => (
                    <tr key={p.id} className="border-b border-[#f2ebdd] last:border-0">
                      <td className="px-5 py-3 font-mono text-xs">{p.sku ?? "—"}</td>
                      <td className="px-5 py-3 font-bold">{p.name}</td>
                      <td className="px-5 py-3 font-serif font-bold">{rupee(currentRate.get(p.id) ?? 0)}/pc</td>
                      <td className="px-5 py-3 text-[#7a6e5e]">{p.qc_required ? "yes" : "no"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          p.is_active ? "bg-[#e6f2ec] text-brand-green" : "bg-[#fbeaea] text-brand-red"
                        }`}>{p.is_active ? "active" : "inactive"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <ProductRowActions
                          productId={p.id} productName={p.name}
                          currentRate={currentRate.get(p.id) ?? 0}
                          isActive={p.is_active}
                        />
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
