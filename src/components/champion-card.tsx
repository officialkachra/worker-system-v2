import { rupee } from "@/lib/payroll";

type Champ = {
  worker_id: string;
  full_name: string;
  worker_code: string;
  total_paise: number;
  total_qty: number;
};

export default function ChampionCard({
  champion, periodLabel = "Is hafte", emoji = "🏆",
}: {
  champion: Champ | null;
  periodLabel?: string;
  emoji?: string;
}) {
  if (!champion) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[#e7ddcd] p-6 text-center confetti-bg">
        <div className="text-4xl mb-2 opacity-40">🏆</div>
        <div className="font-bold text-[#7a6e5e]">Champion of {periodLabel}</div>
        <div className="text-xs text-[#7a6e5e] mt-1">Abhi koi entry approve nahi hui</div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg animate-fade-in-up"
      style={{
        background: "linear-gradient(135deg, #c1440e 0%, #a01a1a 45%, #7a1313 100%)",
      }}>
      {/* Decorative shimmer band */}
      <div className="absolute inset-x-0 top-0 h-1 shimmer-gold" />

      {/* Decorative sparkles */}
      <div className="absolute top-4 right-4 text-[#f5b730] opacity-40 text-2xl">✦</div>
      <div className="absolute bottom-6 left-6 text-[#f5b730] opacity-30 text-lg">✦</div>
      <div className="absolute top-12 left-10 text-[#f5b730] opacity-20 text-sm">✦</div>

      <div className="relative p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#f5b730]">
            {periodLabel} ka Champion
          </span>
        </div>

        <div className="flex items-center gap-4 mt-3">
          <div className="text-6xl animate-trophy-bounce" style={{ transformOrigin: "center bottom" }}>
            {emoji}
          </div>
          <div className="flex-1">
            <div className="font-serif text-3xl font-bold leading-tight">{champion.full_name}</div>
            <div className="text-[#f5b730] text-sm font-mono mt-0.5">{champion.worker_code}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-white/20">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#f5b730] font-bold">Kamai</div>
            <div className="font-serif text-3xl font-bold">{rupee(champion.total_paise)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#f5b730] font-bold">Banaya</div>
            <div className="font-serif text-3xl font-bold">{champion.total_qty} <span className="text-sm font-normal text-white/70">pcs</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
