import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  GetAdminOrdersQueryParams, GetAdminProductsResponse, GetAdminSessionResponse, BatchUpdateOrderStatusBody,
  BatchUpdateOrderStatusResponse, CreateAdminProductBody, CreateAdminProductResponse, UpdateAdminProductBody,
  UpdateAdminProductResponse, DeleteAdminProductParams, DeleteAdminProductResponse, RequestAdminUploadUrlBody,
  RequestAdminUploadUrlResponse, GetAdminSystemHealthResponse,
} from "@workspace/api-zod";
import { db, productsTable, ordersTable, productVariantsTable, inventoryLogsTable, adminAuditLogsTable } from "@workspace/db";
import { requireCatalogAdmin, adminRateLimit, type AdminRequest } from "../middlewares/adminAuth";
import { createProductUpload } from "../lib/adminObjectStorage";
import { runSystemDiagnostics } from "../lib/systemDiagnostics";

const router: IRouter = Router();
router.use("/admin", requireCatalogAdmin, adminRateLimit);
const serializeOrder = (o: typeof ordersTable.$inferSelect) => ({ ...o, total: Number(o.total), subtotal: Number(o.subtotal), bundleDiscount: Number(o.bundleDiscount), walletCreditUsed: Number(o.walletCreditUsed), items: o.items, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(), inventoryDeductedAt: o.inventoryDeductedAt?.toISOString() ?? null, packedAt: o.packedAt?.toISOString() ?? null, shippedAt: o.shippedAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null });
const actorId = (req: any): string => req.admin?.userId ?? "system";
const productView = (p: typeof productsTable.$inferSelect, variants: any[]) => ({ ...p, price: Number(p.price), compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), variants: variants.map((v) => ({ ...v, price: v.price == null ? null : Number(v.price), compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice), createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString() })) });
async function variantsFor(productId: number, tx: any = db): Promise<any[]> {
  const rows = await tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  if (rows.length) return rows;
  const [p] = await tx.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p) return [];
  const sizeCount = Math.max(1, p.sizes.length);
  const baseStock = Math.floor(p.stock / sizeCount);
  for (const [index, size] of p.sizes.entries()) {
    const stock = baseStock + (index < p.stock % sizeCount ? 1 : 0);
    await tx.insert(productVariantsTable).values({
      productId,
      sku: `${p.slug}-${size}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      colorName: "Default",
      colorHex: "#000000",
      size,
      stock,
      initialStock: stock,
    }).onConflictDoNothing();
  }
  return tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId));
}

router.get("/admin/session", (req, res) => { const admin = (req as AdminRequest).admin; res.json(GetAdminSessionResponse.parse({ ...admin, role: "catalog_admin" })); });
router.get("/admin/orders", async (req, res) => {
  const parsed = GetAdminOrdersQueryParams.safeParse(req.query); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const q = parsed.data; const filters: any[] = [];
  if (q.status) filters.push(eq(ordersTable.status, q.status)); if (q.courier) filters.push(eq(ordersTable.courier, q.courier)); if (q.zone) filters.push(eq(ordersTable.zone, q.zone)); if (q.paymentMethod) filters.push(eq(ordersTable.paymentMethod, q.paymentMethod));
  if (q.search) filters.push(or(ilike(ordersTable.orderNumber, `%${q.search}%`), ilike(ordersTable.customerName, `%${q.search}%`), ilike(ordersTable.phone, `%${q.search}%`)));
  const rows = await db.select().from(ordersTable).where(filters.length ? and(...filters) : undefined).orderBy(desc(ordersTable.createdAt)).limit(q.limit);
  res.json(rows.map((o) => ({ ...serializeOrder(o), selected: false })));
});

router.patch("/admin/orders/batch-status", async (req, res) => {
  const parsed = BatchUpdateOrderStatusBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const input = parsed.data; const legal: Record<string, string[]> = { new: ["confirmed", "canceled"], confirmed: ["processing", "canceled"], processing: ["packed", "canceled"], packed: ["ready_to_ship", "canceled"], ready_to_ship: ["shipped"], shipped: ["delivered"], delivered: [], canceled: [], returned: [] };
  try {
    const result = await db.transaction(async (tx) => {
      const updated: any[] = []; const pick = new Map<string, any>();
      for (const id of [...new Set(input.orderIds)].sort((a, b) => a - b)) {
        const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update"); if (!order) throw new Error("Order not found");
        if (order.status !== input.status && !legal[order.status]?.includes(input.status)) throw new Error(`Illegal transition from ${order.status} to ${input.status}`);
        const entering = ["packed", "ready_to_ship", "shipped", "delivered"].includes(input.status) && !order.inventoryDeductedAt;
        if (entering) {
          const lines = order.items as any[];
          for (const line of lines) {
            const [product] = await tx.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, line.productSlug)).for("update");
            if (!product) throw new Error(`Catalog product is missing for ${line.productSlug}`);
            await variantsFor(product.id, tx);
            const [v] = await tx
              .select()
              .from(productVariantsTable)
              .where(and(
                eq(productVariantsTable.productId, product.id),
                eq(productVariantsTable.size, line.size),
                eq(productVariantsTable.active, true),
              ))
              .orderBy(asc(productVariantsTable.id))
              .limit(1)
              .for("update");
            if (!v || v.stock < line.quantity) throw new Error(`Insufficient inventory for ${line.productSlug}`);
            await tx.update(productVariantsTable).set({ stock: v.stock - line.quantity, updatedAt: new Date() }).where(eq(productVariantsTable.id, v.id));
            await tx.update(productsTable).set({ stock: sql`(select coalesce(sum(stock), 0) from sulm_product_variants where product_id = ${v.productId})`, updatedAt: new Date() }).where(eq(productsTable.id, v.productId));
            await tx.insert(inventoryLogsTable).values({ variantId: v.id, orderId: order.id, delta: -line.quantity, reason: "order_fulfillment", idempotencyKey: `order:${order.id}:variant:${v.id}` }).onConflictDoNothing();
            const key = `${line.productSlug}:${line.size}`; const old = pick.get(key) ?? { productName: line.productName, productSlug: line.productSlug, size: line.size, quantity: 0 }; old.quantity += line.quantity; pick.set(key, old);
          }
        }
        const now = new Date(); const fields: any = { status: input.status, courier: input.courier, zone: input.zone, updatedAt: now };
        if (entering) fields.inventoryDeductedAt = now; if (input.status === "packed") fields.packedAt = now; if (input.status === "shipped") fields.shippedAt = now; if (input.status === "delivered") fields.deliveredAt = now;
        const [saved] = await tx.update(ordersTable).set(fields).where(eq(ordersTable.id, id)).returning(); updated.push({ ...serializeOrder(saved), selected: true });
        await tx.insert(adminAuditLogsTable).values({ actorUserId: actorId(req), action: "order_status", entityType: "order", entityId: String(id), metadata: { status: input.status } });
      }
      return { updatedOrders: updated, pickList: [...pick.values()] };
    });
    res.json(BatchUpdateOrderStatusResponse.parse(result));
  } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Unable to update orders" }); }
});

router.get("/admin/products", async (_req, res) => {
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.createdAt));
  const output = await Promise.all(products.map(async (p) => productView(p, await variantsFor(p.id))));
  res.json(GetAdminProductsResponse.parse(output));
});

async function saveProduct(input: any, id?: number, actorUserId?: string): Promise<any> {
  return db.transaction(async (tx) => {
    const values = { slug: input.slug, name: input.name, nameAr: input.nameAr, category: input.category, price: input.price.toFixed(2), compareAtPrice: input.compareAtPrice == null ? null : input.compareAtPrice.toFixed(2), description: input.description, descriptionAr: input.descriptionAr, image: input.image, accent: input.accent, featured: input.featured, story: input.story, status: input.status, sizes: [...new Set(input.variants.map((v: any) => v.size))] as string[], stock: input.variants.reduce((n: number, v: any) => n + v.stock, 0), updatedAt: new Date() };
    let product: any;
    if (id) {
      [product] = await tx.update(productsTable).set(values).where(eq(productsTable.id, id)).returning();
      if (!product) return undefined;
      const existingVariants = await tx.select({ id: productVariantsTable.id }).from(productVariantsTable).where(eq(productVariantsTable.productId, id));
      if (existingVariants.length) {
        await tx.delete(inventoryLogsTable).where(inArray(inventoryLogsTable.variantId, existingVariants.map((variant) => variant.id)));
      }
      await tx.delete(productVariantsTable).where(eq(productVariantsTable.productId, id));
    }
    else [product] = await tx.insert(productsTable).values(values).returning();
    await tx.insert(productVariantsTable).values(input.variants.map((v: any) => ({ productId: product.id, sku: v.sku, colorName: v.colorName, colorHex: v.colorHex, size: v.size, price: v.price == null ? null : v.price.toFixed(2), compareAtPrice: v.compareAtPrice == null ? null : v.compareAtPrice.toFixed(2), stock: v.stock, initialStock: v.stock, chestMm: v.chestMm, lengthMm: v.lengthMm, shouldersMm: v.shouldersMm, sleevesMm: v.sleevesMm, media: v.media, active: v.active })));
    if (actorUserId) await tx.insert(adminAuditLogsTable).values({ actorUserId, action: id ? "product_update" : "product_create", entityType: "product", entityId: String(product.id), metadata: null });
    return productView(product, await tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, product.id)));
  });
}
router.post("/admin/products", async (req, res) => {
  const parsed = CreateAdminProductBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try { res.status(201).json(CreateAdminProductResponse.parse(await saveProduct(parsed.data, undefined, actorId(req)))); } catch { res.status(400).json({ error: "Product could not be saved" }); }
});
router.patch("/admin/products/:id", async (req, res) => {
  const params = DeleteAdminProductParams.safeParse(req.params); const parsed = UpdateAdminProductBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid product" }); return; }
  try { const product = await saveProduct(parsed.data, params.data.id, actorId(req)); if (!product) { res.status(404).json({ error: "Product not found" }); return; } res.json(UpdateAdminProductResponse.parse(product)); } catch { res.status(400).json({ error: "Product could not be saved" }); }
});
router.delete("/admin/products/:id", async (req, res) => {
  const parsed = DeleteAdminProductParams.safeParse(req.params); if (!parsed.success) { res.status(400).json({ error: "Invalid product id" }); return; }
  const deleted = await db.transaction(async (tx) => { const [p] = await tx.select().from(productsTable).where(eq(productsTable.id, parsed.data.id)); if (!p) return false; const variants = await tx.select({ id: productVariantsTable.id }).from(productVariantsTable).where(eq(productVariantsTable.productId, p.id)); if (variants.length) await tx.delete(inventoryLogsTable).where(inArray(inventoryLogsTable.variantId, variants.map((v) => v.id))); await tx.delete(productVariantsTable).where(eq(productVariantsTable.productId, p.id)); await tx.delete(productsTable).where(eq(productsTable.id, p.id)); await tx.insert(adminAuditLogsTable).values({ actorUserId: actorId(req), action: "product_delete", entityType: "product", entityId: String(p.id), metadata: null }); return true; });
  res.json(DeleteAdminProductResponse.parse({ deleted }));
});
router.post("/admin/uploads/request-url", async (req, res) => {
  const parsed = RequestAdminUploadUrlBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await createProductUpload(parsed.data.name, parsed.data.contentType); res.json(RequestAdminUploadUrlResponse.parse(result));
});
router.get("/admin/system/health", async (_req, res) => { res.json(GetAdminSystemHealthResponse.parse(await runSystemDiagnostics())); });

export default router;
