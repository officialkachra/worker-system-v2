import Link from "next/link";
import LogoutButton from "@/components/logout-button";

const TABS: { href: string; label: string }[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/workers", label: "Workers" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/payroll", label: "Payroll" },
];

export default function AdminNav({
  current, adminName,
}: { current: string; adminName: string }) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">SanskritAgain Workers</h1>
          <p className="text-sm text-[#7a6e5e]">{adminName} · admin</p>
        </div>
        <LogoutButton />
      </div>
      <nav className="flex gap-1 border-b border-[#e7ddcd] mb-5 overflow-x-auto">
        {TABS.map(t => {
          const on = current === t.href;
          return (
            <Link key={t.href} href={t.href}
              className={`px-4 py-2.5 text-sm font-bold rounded-t-lg whitespace-nowrap ${
                on
                  ? "bg-white border border-[#e7ddcd] border-b-white text-saffron -mb-px"
                  : "text-[#5a5042] hover:bg-white/50"
              }`}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
