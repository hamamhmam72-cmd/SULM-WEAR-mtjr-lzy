import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { adminAuditLogsTable, inventoryLogsTable, ordersTable, productVariantsTable, productsTable } from "@workspace/db";

export const legalTransitions: Record<string, string[]> = {
  new: ["confirmed", "canceled"], confirmed: ["processing", "canceled"],
  processing: ["packed", "canceled"], packed: ["ready_to_ship"],
  ready_to_ship: ["shipped"], shipped: ["delivered"], delivered: ["returned"], canceled: [], returned: [],
};

export type FulfillmentResult = { order: any; pickList: any[] };

/** The only service allowed to change an order's fulfillment status. */
export async function transitionOrder(tx: any, orderId: number, target: string, actorUserId = "system", extras: any = {}): Promise<FulfillmentResult> {
  const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, orderId)).for("update");
  if (!order) throw new Error("Order not found");
  if (order.status !== target && !legalTransitions[order.status]?.includes(target)) {
    throw new Error(`Illegal transition from ${order.status} to ${target}`);
  }
  const enteringPacked = target === "packed" && !order.inventoryDeductedAt;
  const pick = new Map<string, any>();
  for (const line of order.items as any[]) {
    const key = `${line.variantId ?? `${line.productSlug}:${line.size}`}`;
    const old = pick.get(key) ?? { productName: line.productName, productSlug: line.productSlug, size: `${line.colorName ?? "Legacy"} / ${line.size}`, quantity: 0 };
    old.quantity += line.quantity;
    pick.set(key, old);
  }
  if (enteringPacked) {
    const quantities = new Map<number, number>();
    for (const line of (order.items as any[])) {
      if (!line.variantId) throw new Error("Order item has no variant identity");
      quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
    }
    const ids = [...quantities.keys()].sort((a, b) => a - b);
    const identities = ids.length ? await tx.select({ id: productVariantsTable.id, productId: productVariantsTable.productId }).from(productVariantsTable).where(inArray(productVariantsTable.id, ids)) : [];
    const productIds: number[] = [...new Set<number>(identities.map((variant: { productId: number }) => variant.productId))].sort((a, b) => a - b);
    if (productIds.length) await tx.select({ id: productsTable.id }).from(productsTable).where(inArray(productsTable.id, productIds)).orderBy(asc(productsTable.id)).for("update");
    const variants = ids.length ? await tx.select().from(productVariantsTable).where(inArray(productVariantsTable.id, ids)).orderBy(asc(productVariantsTable.id)).for("update") : [];
    if (variants.length !== ids.length) throw new Error("One or more order variants no longer exist");
    for (const variant of variants) {
      const quantity = quantities.get(variant.id)!;
      if (variant.stock < quantity) throw new Error(`Insufficient inventory for ${variant.sku}`);
      const idempotencyKey = `order:${order.id}:variant:${variant.id}`;
      const [existingLog] = await tx.select().from(inventoryLogsTable)
        .where(eq(inventoryLogsTable.idempotencyKey, idempotencyKey)).limit(1);
      if (existingLog) continue;
      await tx.update(productVariantsTable).set({ stock: variant.stock - quantity, updatedAt: new Date() }).where(eq(productVariantsTable.id, variant.id));
      await tx.insert(inventoryLogsTable).values({
        variantId: variant.id, orderId: order.id, delta: -quantity, reason: "order_fulfillment",
        idempotencyKey,
        actorUserId,
      });
    }
    for (const productId of productIds) {
      await tx.update(productsTable).set({
        stock: sql`(select coalesce(sum(stock), 0) from sulm_product_variants where product_id = ${productId})`,
        updatedAt: new Date(),
      }).where(eq(productsTable.id, productId));
    }
  }
  const now = new Date();
  const fields: any = { ...extras, status: target, updatedAt: now };
  if (enteringPacked) fields.inventoryDeductedAt = now;
  if (target === "packed" && !order.packedAt) fields.packedAt = now;
  if (target === "shipped" && !order.shippedAt) fields.shippedAt = now;
  if (target === "delivered" && !order.deliveredAt) fields.deliveredAt = now;
  const [saved] = await tx.update(ordersTable).set(fields).where(eq(ordersTable.id, order.id)).returning();
  await tx.insert(adminAuditLogsTable).values({ actorUserId, action: "order_status", entityType: "order", entityId: String(order.id), metadata: { status: target } });
  return { order: saved, pickList: [...pick.values()] };
}