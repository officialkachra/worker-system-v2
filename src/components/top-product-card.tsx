import { rupee } from "@/lib/payroll";

type ProductStat = {
  product_id: string; product_name: string; sku: string | null;
  total_qty: number; total_paise: number; worker_count: number;
};

export default function TopProductCard({ product }: { product: ProductStat | null }) {
  if (!product) {
    return (
      <div className="rounded-2xl border border-[#e7ddcd] bg-white p-5 text-center">
        <div className="text-3xl mb-2 opacity-40">📖</div>
        <div className="font-bold text-[#7a6e5e] text-sm">Is month ka top product</div>
        <div className="text-xs text-[#7a6e5e] mt-1">Abhi data nahi</div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-md animate-fade-in-up lift"
      style={{
        background: "linear-gradient(135deg, #fbf3df 0%, #f5b730 100%)",
        animationDelay: "100ms",
      }}>
      <div className="absolute top-3 right-3 text-[#8a5a00] opacity-30 text-3xl">📿</div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a5a00]">
            Is month ka top product
          </span>
        </div>
        <div className="font-serif text-2xl font-bold text-[#5a3a00]">
          {product.product_name}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#b8860b]/30">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8a5a00] font-bold">Quantity</div>
            <div className="font-serif text-2xl font-bold text-[#5a3a00]">{product.total_qty}<span className="text-sm font-normal ml-1">pcs</span></div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#8a5a00] font-bold">Revenue</div>
            <div className="font-serif text-2xl font-bold text-[#5a3a00]">{rupee(product.total_paise)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
