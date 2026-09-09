import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  LookupOrderQueryParams,
  LookupOrderResponse,
} from "@workspace/api-zod";
import { db, loyaltyAccountsTable, loyaltyEventsTable, ordersTable, productsTable } from "@workspace/db";
import { calculateBundle, hashPhone, normalizePhone, verifyLoyaltyToken } from "../lib/retention";

const router: IRouter = Router();

type OrderLine = {
  productName: string;
  productSlug: string;
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
    req.log.warn({ errors: parsed.error.message }, "Invalid order request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, phone, city, address, paymentMethod, items, walletCreditToUse = 0 } = parsed.data;
  const products = await db.select().from(productsTable);
  const lines: OrderLine[] = [];
  for (const item of items) {
    const product = products.find((candidate) => candidate.slug === item.productSlug);
    if (!product) {
      res.status(400).json({ error: `Product ${item.productSlug} was not found` });
      return;
    }
    if (item.quantity > product.stock) {
      res.status(400).json({ error: `${product.name} is not available in that quantity` });
      return;
    }
    if (!product.sizes.includes(item.size)) {
      res.status(400).json({ error: `${item.size} is not available for ${product.name}` });
      return;
    }
    lines.push({
      productName: product.name,
      productSlug: product.slug,
      size: item.size,
      quantity: item.quantity,
      unitPrice: Number(product.price),
    });
  }

  let phoneHash: string;
  try { phoneHash = hashPhone(phone); normalizePhone(phone); }
  catch { res.status(400).json({ error: "Enter a valid phone number" }); return; }
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
  const orderNumber = `SULM-${Date.now().toString().slice(-7)}`;
  const created = await db.transaction(async (tx) => {
    await tx.insert(loyaltyAccountsTable).values({ phoneHash, phoneLastFour: normalizePhone(phone).slice(-4) }).onConflictDoNothing();
    const [account] = await tx.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.phoneHash, phoneHash)).for("update");
    if (!account || walletCreditToUse > Number(account.walletCredit) || walletCreditToUse > quote.total) return undefined;
    const [order] = await tx.insert(ordersTable).values({
      orderNumber,
      customerName,
      phone,
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
      accountId: account.id, source: "purchase", reference: order.orderNumber,
      points: pendingPurchasePoints, status: "pending",
    });
    return order;
  });
  if (!created) { res.status(400).json({ error: "Wallet credit changed. Verify your balance and try again." }); return; }

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
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.orderNumber, req.params.orderNumber)).for("update");
    if (!order) return undefined;
    const [event] = await tx.select().from(loyaltyEventsTable).where(and(eq(loyaltyEventsTable.source, "purchase"), eq(loyaltyEventsTable.reference, order.orderNumber))).for("update");
    if (!event) return undefined;
    if (event.status === "approved") return order;
    const normalized = normalizePhone(order.phone);
    const [account] = await tx.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.phoneHash, hashPhone(normalized))).for("update");
    if (!account) return undefined;
    await tx.update(loyaltyEventsTable).set({ status: "approved" }).where(eq(loyaltyEventsTable.id, event.id));
    await tx.update(loyaltyAccountsTable).set({
      points: account.points + event.points,
      pendingPoints: Math.max(0, account.pendingPoints - event.points),
      updatedAt: new Date(),
    }).where(eq(loyaltyAccountsTable.id, account.id));
    const [updatedOrder] = await tx.update(ordersTable).set({
      status: "shipped",
      loyaltyPointsEarned: event.points,
    }).where(eq(ordersTable.id, order.id)).returning();
    return updatedOrder;
  });
  if (!completed) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(CreateOrderResponse.parse(toOrder(completed)));
});

router.get("/orders/lookup", async (req, res): Promise<void> => {
  const parsed = LookupOrderQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.orderNumber, parsed.data.orderNumber),
        eq(ordersTable.phone, parsed.data.phone),
      ),
    );
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(LookupOrderResponse.parse(toOrder(order)));
});

export default router;