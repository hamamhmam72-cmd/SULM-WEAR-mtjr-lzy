import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export type DiagnosticCheck = { key: string; status: "healthy" | "warning" | "critical"; message: string; checkedAt: string };
const routeMetrics = new Map<string, { requests: number; errors: number; totalMs: number }>();

export function recordRouteMetric(route: string, durationMs: number, error = false): void {
  // Keep diagnostics bounded even when a proxy supplies unbounded route strings.
  if (routeMetrics.size >= 200 && !routeMetrics.has(route)) route = "OTHER";
  const item = routeMetrics.get(route) ?? { requests: 0, errors: 0, totalMs: 0 };
  item.requests += 1; item.totalMs += durationMs; if (error) item.errors += 1;
  routeMetrics.set(route, item);
}

export async function runSystemDiagnostics(): Promise<{ status: "healthy" | "warning" | "critical"; checks: DiagnosticCheck[]; routeMetrics: { route: string; requests: number; errors: number; averageMs: number }[] }> {
  const checks: DiagnosticCheck[] = [];
  const checkedAt = () => new Date().toISOString();
  try {
    await db.execute(sql`select 1`);
    checks.push({ key: "database", status: "healthy", message: "Database is reachable", checkedAt: checkedAt() });
    const relations = await db.execute(sql`select to_regclass('sulm_products'), to_regclass('sulm_product_variants'), to_regclass('sulm_inventory_logs'), to_regclass('sulm_orders')`);
    const values = Object.values(relations.rows[0] ?? {});
    checks.push({ key: "relations", status: values.every(Boolean) ? "healthy" : "critical", message: values.every(Boolean) ? "Required relations exist" : "One or more required relations are missing", checkedAt: checkedAt() });
    const duplicates = await db.execute(sql`select count(*)::int as count from (select sku from sulm_product_variants group by sku having count(*) > 1) d`);
    checks.push({ key: "sku_uniqueness", status: Number(duplicates.rows[0]?.count ?? 0) === 0 ? "healthy" : "critical", message: Number(duplicates.rows[0]?.count ?? 0) === 0 ? "SKUs are unique" : "Duplicate SKUs detected", checkedAt: checkedAt() });
    const equation = await db.execute(sql`select count(*)::int as count from sulm_product_variants v where v.stock <> v.initial_stock + coalesce((select sum(l.delta) from sulm_inventory_logs l where l.variant_id=v.id), 0)`);
    checks.push({ key: "inventory_equation", status: Number(equation.rows[0]?.count ?? 0) === 0 ? "healthy" : "critical", message: Number(equation.rows[0]?.count ?? 0) === 0 ? "Inventory equations balance" : "Inventory equation mismatch", checkedAt: checkedAt() });
    const deducted = await db.execute(sql`select count(*)::int as count from sulm_orders o where o.inventory_deducted_at is not null and not exists (select 1 from sulm_inventory_logs l where l.order_id=o.id)`);
    checks.push({ key: "order_inventory_logs", status: Number(deducted.rows[0]?.count ?? 0) === 0 ? "healthy" : "critical", message: Number(deducted.rows[0]?.count ?? 0) === 0 ? "Deducted orders have inventory logs" : "Deducted orders are missing inventory logs", checkedAt: checkedAt() });
  } catch {
    checks.push({ key: "database", status: "critical", message: "Diagnostics could not complete", checkedAt: checkedAt() });
  }
  const status = checks.some((c) => c.status === "critical") ? "critical" : checks.some((c) => c.status === "warning") ? "warning" : "healthy";
  return { status, checks, routeMetrics: [...routeMetrics.entries()].map(([route, m]) => ({ route, requests: m.requests, errors: m.errors, averageMs: m.requests ? Number((m.totalMs / m.requests).toFixed(2)) : 0 })) };
}