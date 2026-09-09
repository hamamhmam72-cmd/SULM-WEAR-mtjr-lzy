import { and, eq } from "drizzle-orm";
import { db, ordersTable, productVariantsTable, productsTable } from "@workspace/db";

/** Return variants, creating the single legacy default color matrix when needed. */
export async function variantsFor(productId: number, tx: any = db): Promise<any[]> {
  let rows = await tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  if (rows.length) return rows;
  const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return [];
  const count = Math.max(1, product.sizes.length);
  const base = Math.floor(product.stock / count);
  for (const [index, size] of product.sizes.entries()) {
    const stock = base + (index < product.stock % count ? 1 : 0);
    await tx.insert(productVariantsTable).values({
      productId, sku: `${product.slug}-${size}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      colorName: "Default", colorHex: "#000000", size, stock, initialStock: stock,
    }).onConflictDoNothing();
  }
  return tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
}

export async function activeVariant(productId: number, variantId: number, size: string, tx: any = db) {
  const [variant] = await tx.select().from(productVariantsTable).where(and(
    eq(productVariantsTable.id, variantId), eq(productVariantsTable.productId, productId),
    eq(productVariantsTable.size, size), eq(productVariantsTable.active, true),
  ));
  return variant;
}

/** Upgrade pre-variant order snapshots before fulfillment routes become available. */
export async function backfillLegacyOrderVariants(): Promise<void> {
  const products = await db.select().from(productsTable);
  for (const product of products) await variantsFor(product.id);
  const variants = await db.select().from(productVariantsTable);
  const orders = await db.select().from(ordersTable);
  for (const order of orders) {
    const items = order.items as Array<Record<string, unknown>>;
    if (items.every((item) => typeof item.variantId === "number")) continue;
    const upgraded = items.map((item, index) => {
      if (typeof item.variantId === "number") return item;
      const product = products.find((row) => row.slug === item.productSlug);
      const candidates = product
        ? variants.filter((row) => row.productId === product.id && row.size === item.size)
        : [];
      const defaults = candidates.filter((row) => row.colorName === "Default");
      const variant = candidates.length === 1 ? candidates[0] : defaults.length === 1 ? defaults[0] : undefined;
      if (!product || !variant) {
        throw new Error(`Legacy order ${order.id} item ${index + 1} needs variant reconciliation`);
      }
      return {
        ...item,
        variantId: variant.id,
        sku: variant.sku,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        unitPrice: Number(item.unitPrice ?? variant.price ?? product.price),
      };
    });
    await db.update(ordersTable).set({ items: upgraded, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));
  }
}