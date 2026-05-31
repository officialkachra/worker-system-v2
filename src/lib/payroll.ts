// All money is in PAISE (integer). ₹8.00 = 800. Never floats.

export const rupee = (paise: number): string =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const ym = (isoDate: string): string => isoDate.slice(0, 7);

export function currentYm(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function prevYm(d = new Date()): string {
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

export type ProductionLog = {
  id?: string;
  worker_id: string; product_id: string; quantity: number;
  rate_paise: number; amount_paise: number;
  status: "pending" | "approved" | "rejected";
  work_date: string; note?: string | null;
};
export type LedgerEntry = {
  id?: string;
  worker_id: string;
  kind: "earning" | "payment" | "advance" | "bonus" | "penalty" | "reversal";
  credit_paise: number; debit_paise: number;
  description?: string | null;
  payment_mode?: string | null;
  source_log_id?: string | null;
  is_locked?: boolean;
  created_at: string;
};

// Earnings from approved logs.
export function earnedPaise(logs: ProductionLog[], workerId: string, month?: string): number {
  return logs
    .filter(l => l.worker_id === workerId && l.status === "approved" && (!month || ym(l.work_date) === month))
    .reduce((s, l) => s + l.amount_paise, 0);
}

export function ledgerSum(
  ledger: LedgerEntry[], workerId: string,
  kind: LedgerEntry["kind"], month?: string
): number {
  return ledger
    .filter(e => e.worker_id === workerId && e.kind === kind && (!month || ym(e.created_at) === month))
    .reduce((s, e) => s + (e.credit_paise || e.debit_paise), 0);
}

// Net due. Reversal entries automatically cancel since they have opposite credit/debit.
// Formula: SUM(credits) - SUM(debits) across ALL entries (including earnings from logs).
export function duePaise(logs: ProductionLog[], ledger: LedgerEntry[], workerId: string): number {
  const earned = earnedPaise(logs, workerId);
  let credit = earned;
  let debit = 0;
  for (const e of ledger) {
    if (e.worker_id !== workerId) continue;
    credit += e.credit_paise;
    debit += e.debit_paise;
  }
  return credit - debit;
}

// Friendly date helpers for gamification UI
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function daysInCurrentMonth(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function todayDayOfMonth(): number {
  return new Date().getDate();
}

// Parse URL search params into a date range (YYYY-MM-DD strings)
export function parseDateRange(
  preset?: string | null, from?: string | null, to?: string | null
): { from: string; to: string; label: string } {
  // Custom range takes priority
  if (from && to) return { from, to, label: `${from} → ${to}` };

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (preset === "week" || preset === "7days") {
    const start = new Date(today); start.setDate(today.getDate() - 6);
    return { from: fmt(start), to: fmt(today), label: "Last 7 din" };
  }
  if (preset === "prev_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: fmt(start), to: fmt(end), label: "Last month" };
  }
  if (preset === "all") {
    return { from: "2020-01-01", to: fmt(today), label: "All time" };
  }
  // Default: this month
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: fmt(start), to: fmt(today), label: "Is month" };
}
