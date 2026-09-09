import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  LookupOrderQueryParams,
  LookupOrderResponse,
} from "@workspace/api-zod";
import {
  db,
  loyaltyAccountsTable,
  loyaltyEventsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
} from "@workspace/db";
import { calculateBundle, hashPhone, normalizePhone, verifyLoyaltyToken } from "../lib/retention";
import { variantsFor } from "../lib/catalog";

const router: IRouter = Router();

type OrderLine = {
  productName: string;
  productSlug: string;
  variantId: number;
  sku: string;
  colorName: string;
  colorHex: string;
  size: string;
  quantity: number;
  unitPrice: number;
};

const toOrder = (order: typeof ordersTable.$inferSelect) => ({
  ...order,
  subtotal: Number(order.subtotal),
  bundleDiscount: Number(order.bundleDiscount),
  walletCreditUsed: Number(order.walletCreditUsed),
  total: Number(order.total),
  items: order.items as OrderLine[],
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  inventoryDeductedAt: order.inventoryDeductedAt?.toISOString() ?? null,
  packedAt: order.packedAt?.toISOString() ?? null,
  shippedAt: order.shippedAt?.toISOString() ?? null,
  deliveredAt: order.deliveredAt?.toISOString() ?? null,
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ validationIssues: parsed.error.issues.length }, "Invalid order request");
    res.status(400).json({ error: "Check the order details and try again" });
    return;
  }
  const { customerName, phone, city, address, paymentMethod, items, walletCreditToUse = 0 } = parsed.data;
  let normalizedPhone: string;
  let phoneHash: string;
  try {
    normalizedPhone = normalizePhone(phone);
    phoneHash = hashPhone(normalizedPhone);
  } catch {
    res.status(400).json({ error: "Enter a valid phone number" });
    return;
  }

  const lines = await db.transaction(async (tx) => {
    const productSlugs = [...new Set(items.map((item) => item.productSlug))];
    const products = productSlugs.length
      ? await tx.select().from(productsTable).where(inArray(productsTable.slug, productSlugs))
      : [];
    for (const product of products) await variantsFor(product.id, tx);
    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const variants = variantIds.length
      ? await tx.select().from(productVariantsTable).where(inArray(productVariantsTable.id, variantIds))
      : [];
    const requested = new Map<number, number>();
    for (const item of items) requested.set(item.variantId, (requested.get(item.variantId) ?? 0) + item.quantity);
    const output: OrderLine[] = [];
    for (const item of items) {
      const product = products.find((candidate) => candidate.slug === item.productSlug);
      const variant = variants.find((candidate) => candidate.id === item.variantId);
      if (
        !product ||
        !variant ||
        variant.productId !== product.id ||
        variant.size !== item.size ||
        !variant.active ||
        variant.stock < (requested.get(variant.id) ?? 0)
      ) {
        throw new Error("One or more selected variants are no longer available");
      }
      output.push({
        productName: product.name,
        productSlug: product.slug,
        variantId: variant.id,
        sku: variant.sku,
        colorName: variant.colorName,
        colorHex: variant.colorHex,
        size: variant.size,
        quantity: item.quantity,
        unitPrice: variant.price == null ? Number(product.price) : Number(variant.price),
      });
    }
    return output;
  }).catch(() => undefined);
  if (!lines) {
    res.status(400).json({ error: "One or more selected variants are no longer available" });
    return;
  }

  const quote = calculateBundle(lines);
  if (walletCreditToUse > 0) {
    try {
      const verified = verifyLoyaltyToken(parsed.data.loyaltyVerificationToken ?? "");
      if (verified.phoneHash !== phoneHash) throw new Error("Phone mismatch");
    } catch {
      res.status(401).json({ error: "Verify a previous order before using wallet credit" });
      return;
    }
  }
  const total = Number((quote.total - walletCreditToUse).toFixed(2));
  const pendingPurchasePoints = Math.floor(total);
  const orderNumber = `SULM-${Date.now().toString(36).toUpperCase()}`;
  const created = await db.transaction(async (tx) => {
    await tx.insert(loyaltyAccountsTable).values({
      phoneHash,
      phoneLastFour: normalizedPhone.slice(-4),
    }).onConflictDoNothing();
    const [account] = await tx.select().from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.phoneHash, phoneHash)).for("update");
    if (!account || walletCreditToUse > Number(account.walletCredit) || walletCreditToUse > quote.total) return undefined;
    const [order] = await tx.insert(ordersTable).values({
      orderNumber,
      customerName,
      phone: normalizedPhone,
      city,
      address,
      paymentMethod,
      status: "new",
      subtotal: quote.subtotal.toFixed(2),
      bundleDiscount: quote.discount.toFixed(2),
      walletCreditUsed: walletCreditToUse.toFixed(2),
      loyaltyPointsEarned: 0,
      total: total.toFixed(2),
      items: lines,
    }).returning();
    await tx.update(loyaltyAccountsTable).set({
      pendingPoints: account.pendingPoints + pendingPurchasePoints,
      walletCredit: (Number(account.walletCredit) - walletCreditToUse).toFixed(2),
      updatedAt: new Date(),
    }).where(eq(loyaltyAccountsTable.id, account.id));
    await tx.insert(loyaltyEventsTable).values({
      accountId: account.id,
      source: "purchase",
      reference: order.orderNumber,
      points: pendingPurchasePoints,
      status: "pending",
    });
    return order;
  });
  if (!created) {
    res.status(400).json({ error: "Wallet credit changed. Verify your balance and try again." });
    return;
  }
  req.log.info({ orderNumber: created.orderNumber, total }, "Order created");
  res.status(201).json(CreateOrderResponse.parse(toOrder(created)));
});

router.post("/orders/:orderNumber/complete", async (req, res): Promise<void> => {
  const supplied = req.header("x-internal-secret") ?? "";
  const expected = process.env.SESSION_SECRET ?? "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (!expected || suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const completed = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(ordersTable)
      .where(eq(ordersTable.orderNumber, req.params.orderNumber)).for("update");
    if (!order || order.status !== "delivered") return undefined;
    const [event] = await tx.select().from(loyaltyEventsTable)
      .where(and(eq(loyaltyEventsTable.source, "purchase"), eq(loyaltyEventsTable.reference, order.orderNumber)))
      .for("update");
    if (!event) return undefined;
    if (event.status === "approved") return order;
    const [account] = await tx.select().from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.phoneHash, hashPhone(order.phone))).for("update");
    if (!account) return undefined;
    await tx.update(loyaltyEventsTable).set({ status: "approved" }).where(eq(loyaltyEventsTable.id, event.id));
    await tx.update(loyaltyAccountsTable).set({
      points: account.points + event.points,
      pendingPoints: Math.max(0, account.pendingPoints - event.points),
      updatedAt: new Date(),
    }).where(eq(loyaltyAccountsTable.id, account.id));
    const [updated] = await tx.update(ordersTable).set({
      loyaltyPointsEarned: event.points,
      updatedAt: new Date(),
    }).where(eq(ordersTable.id, order.id)).returning();
    return updated;
  });
  if (!completed) {
    res.status(409).json({ error: "Order must be delivered before points are approved" });
    return;
  }
  res.json(CreateOrderResponse.parse(toOrder(completed)));
});

const lookupWindows = new Map<string, { count: number; resetAt: number }>();
router.get("/orders/lookup", async (req, res): Promise<void> => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const window = lookupWindows.get(key);
  if (!window || window.resetAt <= now) lookupWindows.set(key, { count: 1, resetAt: now + 60_000 });
  else if (++window.count > 20) {
    res.status(429).json({ error: "Too many tracking attempts. Try again shortly." });
    return;
  }
  const parsed = LookupOrderQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid order number and phone" });
    return;
  }
  let phone: string;
  try { phone = normalizePhone(parsed.data.phone); }
  catch { res.status(400).json({ error: "Enter a valid phone number" }); return; }
  const [order] = await db.select().from(ordersTable).where(and(
    eq(ordersTable.orderNumber, parsed.data.orderNumber),
    eq(ordersTable.phone, phone),
  ));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(LookupOrderResponse.parse(toOrder(order)));
});

export default router;