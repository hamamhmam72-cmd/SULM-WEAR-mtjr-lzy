import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  GetAdminOrdersQueryParams, GetAdminOrdersResponse, GetAdminProductsResponse, GetAdminSessionResponse, BatchUpdateOrderStatusBody,
  BatchUpdateOrderStatusResponse, CreateAdminProductBody, CreateAdminProductResponse, UpdateAdminProductBody,
  UpdateAdminProductResponse, DeleteAdminProductParams, DeleteAdminProductResponse, RequestAdminUploadUrlBody,
  RequestAdminUploadUrlResponse, GetAdminSystemHealthResponse,
} from "@workspace/api-zod";
import { db, productsTable, ordersTable, productVariantsTable, inventoryLogsTable, adminAuditLogsTable } from "@workspace/db";
import { requireCatalogAdmin, adminRateLimit, type AdminRequest } from "../middlewares/adminAuth";
import { createProductUpload } from "../lib/adminObjectStorage";
import { runSystemDiagnostics } from "../lib/systemDiagnostics";
import { variantsFor } from "../lib/catalog";
import { transitionOrder } from "../lib/fulfillment";

const router: IRouter = Router();
router.use("/admin", requireCatalogAdmin, adminRateLimit);
const serializeOrder = (o: typeof ordersTable.$inferSelect) => ({ ...o, total: Number(o.total), subtotal: Number(o.subtotal), bundleDiscount: Number(o.bundleDiscount), walletCreditUsed: Number(o.walletCreditUsed), items: o.items, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(), inventoryDeductedAt: o.inventoryDeductedAt?.toISOString() ?? null, packedAt: o.packedAt?.toISOString() ?? null, shippedAt: o.shippedAt?.toISOString() ?? null, deliveredAt: o.deliveredAt?.toISOString() ?? null });
const actorId = (req: any): string => req.admin?.userId ?? "system";
const productView = (p: typeof productsTable.$inferSelect, variants: any[]) => ({ ...p, price: Number(p.price), compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), variants: variants.map((v) => ({ ...v, price: v.price == null ? null : Number(v.price), compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice), createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString() })) });
router.get("/admin/session", (req, res) => { const admin = (req as AdminRequest).admin; res.json(GetAdminSessionResponse.parse({ ...admin, role: "catalog_admin" })); });
router.get("/admin/orders", async (req, res) => {
  const parsed = GetAdminOrdersQueryParams.safeParse(req.query); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const q = parsed.data; const filters: any[] = [];
  if (q.status) filters.push(eq(ordersTable.status, q.status)); if (q.courier) filters.push(eq(ordersTable.courier, q.courier)); if (q.zone) filters.push(eq(ordersTable.zone, q.zone)); if (q.paymentMethod) filters.push(eq(ordersTable.paymentMethod, q.paymentMethod));
  if (q.search) filters.push(or(ilike(ordersTable.orderNumber, `%${q.search}%`), ilike(ordersTable.customerName, `%${q.search}%`), ilike(ordersTable.phone, `%${q.search}%`)));
  const where = filters.length ? and(...filters) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(ordersTable).where(where);
  const pagedRows = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt))
    .limit(q.limit).offset((q.page - 1) * q.limit);
  res.json(GetAdminOrdersResponse.parse({
    orders: pagedRows.map((o) => ({ ...serializeOrder(o), selected: false })),
    total,
    page: q.page,
    pageSize: q.limit,
    totalPages: Math.max(1, Math.ceil(total / q.limit)),
  }));
});

router.patch("/admin/orders/batch-status", async (req, res) => {
  const parsed = BatchUpdateOrderStatusBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const input = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const updated: any[] = []; const pick = new Map<string, any>();
       for (const id of [...new Set(input.orderIds)].sort((a, b) => a - b)) {
         const extras = {
           ...(input.courier == null ? {} : { courier: input.courier }),
           ...(input.zone == null ? {} : { zone: input.zone }),
         };
         const result = await transitionOrder(tx, id, input.status, actorId(req), extras);
         updated.push({ ...serializeOrder(result.order), selected: true });
         for (const item of result.pickList) {
           const key = `${item.productSlug}:${item.size}`;
           const old = pick.get(key) ?? { ...item, quantity: 0 };
           old.quantity += item.quantity;
           pick.set(key, old);
         }
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

export async function saveProduct(input: any, id?: number, actorUserId?: string): Promise<any> {
  return db.transaction(async (tx) => {
    const values = { slug: input.slug, name: input.name, nameAr: input.nameAr, category: input.category, price: input.price.toFixed(2), compareAtPrice: input.compareAtPrice == null ? null : input.compareAtPrice.toFixed(2), description: input.description, descriptionAr: input.descriptionAr, image: input.image, accent: input.accent, featured: input.featured, story: input.story, status: input.status, sizes: [...new Set(input.variants.map((v: any) => v.size))] as string[], stock: input.variants.reduce((n: number, v: any) => n + v.stock, 0), updatedAt: new Date() };
    let product: any;
    if (id) {
      [product] = await tx.update(productsTable).set(values).where(eq(productsTable.id, id)).returning();
      if (!product) return undefined;
       const existingVariants = await tx.select().from(productVariantsTable).where(eq(productVariantsTable.productId, id)).for("update");
       const incomingIds = new Set(input.variants.map((v: any) => v.id).filter(Boolean));
       const existingIds = new Set(existingVariants.map((variant) => variant.id));
       if ([...incomingIds].some((variantId) => !existingIds.has(variantId as number))) {
         throw new Error("A variant does not belong to this product");
       }
       for (const old of existingVariants) {
         const next = input.variants.find((v: any) => v.id === old.id);
         if (!next) {
           await tx.update(productVariantsTable).set({ active: false, updatedAt: new Date() }).where(eq(productVariantsTable.id, old.id));
         } else {
           if (next.expectedStock !== undefined && next.expectedStock !== old.stock) {
             throw new Error(`Stock changed for ${old.sku}; reload before saving`);
           }
           const delta = next.stock - old.stock;
           await tx.update(productVariantsTable).set({
             sku: next.sku, colorName: next.colorName, colorHex: next.colorHex, size: next.size,
             price: next.price == null ? null : next.price.toFixed(2), compareAtPrice: next.compareAtPrice == null ? null : next.compareAtPrice.toFixed(2),
             stock: next.stock, chestMm: next.chestMm, lengthMm: next.lengthMm, shouldersMm: next.shouldersMm, sleevesMm: next.sleevesMm,
             media: next.media, active: next.active, updatedAt: new Date(),
           }).where(eq(productVariantsTable.id, old.id));
           if (delta) await tx.insert(inventoryLogsTable).values({ variantId: old.id, delta, reason: "admin_adjustment", idempotencyKey: `admin:${product.id}:${old.id}:${Date.now()}`, actorUserId }).onConflictDoNothing();
         }
       }
       const additions = input.variants.filter((v: any) => !incomingIds.has(v.id));
        if (additions.length) await tx.insert(productVariantsTable).values(additions.map((v: any) => ({ productId: id, sku: v.sku, colorName: v.colorName, colorHex: v.colorHex, size: v.size, price: v.price == null ? null : v.price.toFixed(2), compareAtPrice: v.compareAtPrice == null ? null : v.compareAtPrice.toFixed(2), stock: v.stock, initialStock: v.stock, chestMm: v.chestMm, lengthMm: v.lengthMm, shouldersMm: v.shouldersMm, sleevesMm: v.sleevesMm, media: v.media, active: v.active })));
    }
    else [product] = await tx.insert(productsTable).values(values).returning();
     if (!id) await tx.insert(productVariantsTable).values(input.variants.map((v: any) => ({ productId: product.id, sku: v.sku, colorName: v.colorName, colorHex: v.colorHex, size: v.size, price: v.price == null ? null : v.price.toFixed(2), compareAtPrice: v.compareAtPrice == null ? null : v.compareAtPrice.toFixed(2), stock: v.stock, initialStock: v.stock, chestMm: v.chestMm, lengthMm: v.lengthMm, shouldersMm: v.shouldersMm, sleevesMm: v.sleevesMm, media: v.media, active: v.active })));
    const [{ stock }] = await tx.select({ stock: sql<number>`coalesce(sum(${productVariantsTable.stock}), 0)::int` })
      .from(productVariantsTable).where(eq(productVariantsTable.productId, product.id));
    [product] = await tx.update(productsTable).set({ stock, updatedAt: new Date() })
      .where(eq(productsTable.id, product.id)).returning();
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
   try {
     const deleted = await db.transaction(async (tx) => { const [p] = await tx.select().from(productsTable).where(eq(productsTable.id, parsed.data.id)).for("update"); if (!p) return false; const variants = await tx.select({ id: productVariantsTable.id }).from(productVariantsTable).where(eq(productVariantsTable.productId, p.id)).for("update"); const variantIds = variants.map((v) => v.id); const refs = variantIds.length ? await tx.select({ id: inventoryLogsTable.id }).from(inventoryLogsTable).where(inArray(inventoryLogsTable.variantId, variantIds)).limit(1) : []; const orders = variantIds.length ? await tx.execute(sql`select id from sulm_orders o where exists (select 1 from jsonb_array_elements(o.items) item where item ? 'variantId' and (item->>'variantId')::int = any(${variantIds}::int[])) limit 1`) : { rows: [] }; if (refs.length || orders.rows.length) throw new Error("Product has order or ledger history; archive it instead"); await tx.delete(productVariantsTable).where(eq(productVariantsTable.productId, p.id)); await tx.delete(productsTable).where(eq(productsTable.id, p.id)); await tx.insert(adminAuditLogsTable).values({ actorUserId: actorId(req), action: "product_delete", entityType: "product", entityId: String(p.id), metadata: null }); return true; });
     res.json(DeleteAdminProductResponse.parse({ deleted }));
   } catch (error) {
     res.status(error instanceof Error && error.message.includes("ledger history") ? 409 : 400).json({ error: error instanceof Error ? error.message : "Product could not be deleted" });
   }
});
router.post("/admin/uploads/request-url", async (req, res) => {
  const parsed = RequestAdminUploadUrlBody.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const result = await createProductUpload(parsed.data.name, parsed.data.contentType); res.json(RequestAdminUploadUrlResponse.parse(result));
});
router.get("/admin/system/health", async (_req, res) => { res.json(GetAdminSystemHealthResponse.parse(await runSystemDiagnostics())); });

export default router;
