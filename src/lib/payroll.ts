// All money is in PAISE (integer). ₹8.00 = 800. Never use floats for money.

export const rupee = (paise: number): string =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// Calendar-month helpers (cycle = 1st to month-end, per your choice)
export const ym = (isoDate: string): string => isoDate.slice(0, 7); // "2026-05"

export function currentYm(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function prevYm(d = new Date()): string {
  const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`;
}

export type ProductionLog = {
  worker_id: string; product_id: string; quantity: number;
  rate_paise: number; amount_paise: number; status: "pending" | "approved" | "rejected";
  work_date: string;
};
export type LedgerEntry = {
  worker_id: string; kind: "earning" | "payment" | "advance" | "bonus" | "penalty" | "reversal";
  credit_paise: number; debit_paise: number; created_at: string;
};

// Earnings come from approved logs (optionally filtered to a month "YYYY-MM").
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

// Net due = (all earnings + bonuses) - (payments + advances + penalties)
export function duePaise(logs: ProductionLog[], ledger: LedgerEntry[], workerId: string): number {
  const earned = earnedPaise(logs, workerId);
  const bonus = ledgerSum(ledger, workerId, "bonus");
  const paid = ledgerSum(ledger, workerId, "payment");
  const advance = ledgerSum(ledger, workerId, "advance");
  const penalty = ledgerSum(ledger, workerId, "penalty");
  return earned + bonus - (paid + advance + penalty);
}
