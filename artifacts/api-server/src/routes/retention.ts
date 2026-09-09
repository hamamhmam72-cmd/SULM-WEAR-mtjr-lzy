import { Router, type IRouter } from "express";
import { and, eq, gt } from "drizzle-orm";
import {
  CreateLoyaltyReviewBody,
  CreateLoyaltyReviewResponse,
  CreateReturnRequestBody,
  CreateReturnRequestResponse,
  LookupLoyaltyBody,
  LookupLoyaltyResponse,
  LookupReturnRequestsBody,
  LookupReturnRequestsResponse,
  QuoteBundleBody,
  QuoteBundleResponse,
  RedeemLoyaltyPointsBody,
  RedeemLoyaltyPointsResponse,
  SubscribeCartReminderBody,
  SubscribeCartReminderResponse,
  UnsubscribeCartReminderBody,
  UnsubscribeCartReminderResponse,
  GetCartReminderParams,
  GetCartReminderResponse,
  MarkCartReminderDeliveredParams,
  MarkCartReminderDeliveredResponse,
} from "@workspace/api-zod";
import {
  cartRemindersTable,
  db,
  loyaltyAccountsTable,
  loyaltyEventsTable,
  ordersTable,
  productsTable,
  returnRequestsTable,
} from "@workspace/db";
import { calculateBundle, cartFingerprint, encryptPhone, hashPhone, maskPhone, newPublicToken, normalizePhone, signLoyaltyToken, verifyLoyaltyToken } from "../lib/retention";

const router: IRouter = Router();
const hits = new Map<string, { count: number; reset: number }>();
router.use((req, res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + 15 * 60_000 });
  else if (++entry.count > 60) {
    res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }
  next();
});

const profileFor = (row: typeof loyaltyAccountsTable.$inferSelect, phone: string, verificationToken: string) => {
  const tier = row.points >= 1000 ? "black" : row.points >= 500 ? "silver" : "member";
  return {
    maskedPhone: maskPhone(phone),
    points: row.points,
    walletCredit: Number(row.walletCredit),
    pendingPoints: row.pendingPoints,
    tier,
    nextTierAt: tier === "member" ? 500 : tier === "silver" ? 1000 : null,
    verificationToken,
  };
};

const accountFor = async (phone: string) => {
  const normalized = normalizePhone(phone);
  const phoneHash = hashPhone(normalized);
  let [account] = await db.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.phoneHash, phoneHash));
  if (!account) {
    [account] = await db.insert(loyaltyAccountsTable).values({ phoneHash, phoneLastFour: normalized.slice(-4) }).returning();
  }
  return account;
};

const verifiedOrder = async (orderNumber: string, phone: string) => {
  const normalized = normalizePhone(phone);
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.orderNumber, orderNumber), eq(ordersTable.phone, phone)));
  if (order) return order;
  const [normalizedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
  return normalizedOrder && normalizePhone(normalizedOrder.phone) === normalized ? normalizedOrder : undefined;
};

router.post("/loyalty/lookup", async (req, res): Promise<void> => {
  const parsed = LookupLoyaltyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a valid phone number" }); return; }
  try {
    const order = await verifiedOrder(parsed.data.orderNumber, parsed.data.phone);
    if (!order) { res.status(404).json({ error: "Verified order not found" }); return; }
    const account = await accountFor(parsed.data.phone);
    const token = signLoyaltyToken(account.phoneHash);
    res.json(LookupLoyaltyResponse.parse(profileFor(account, parsed.data.phone, token)));
  } catch { res.status(400).json({ error: "Enter a valid phone number" }); }
});

router.post("/loyalty/redeem", async (req, res): Promise<void> => {
  const parsed = RedeemLoyaltyPointsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Redeem points in blocks of 100" }); return; }
  let verified: { phoneHash: string };
  try { verified = verifyLoyaltyToken(parsed.data.verificationToken); }
  catch { res.status(401).json({ error: "Verification expired. Verify your order again." }); return; }
  const [account] = await db.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.phoneHash, verified.phoneHash));
  if (!account) { res.status(404).json({ error: "Loyalty account not found" }); return; }
  if (account.points < parsed.data.points) { res.status(400).json({ error: "Not enough points" }); return; }
  const creditAdded = parsed.data.points * 0.05;
  const updated = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.id, account.id)).for("update");
    if (!locked || locked.points < parsed.data.points) return undefined;
    const [row] = await tx.update(loyaltyAccountsTable).set({
      points: locked.points - parsed.data.points,
      walletCredit: (Number(locked.walletCredit) + creditAdded).toFixed(2),
      updatedAt: new Date(),
    }).where(eq(loyaltyAccountsTable.id, locked.id)).returning();
    return row;
  });
  if (!updated) { res.status(400).json({ error: "Not enough points" }); return; }
  const token = signLoyaltyToken(updated.phoneHash);
  res.json(RedeemLoyaltyPointsResponse.parse({ creditAdded, profile: profileFor(updated, `0000${updated.phoneLastFour}`, token) }));
});

router.post("/loyalty/reviews", async (req, res): Promise<void> => {
  const parsed = CreateLoyaltyReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the review details" }); return; }
  const order = await verifiedOrder(parsed.data.orderNumber, parsed.data.phone);
  const items = order?.items as Array<{ productSlug: string }> | undefined;
  if (!order || !items?.some((item) => item.productSlug === parsed.data.productSlug)) {
    res.status(404).json({ error: "Verified purchase not found" }); return;
  }
  if (order.status !== "shipped") {
    res.status(400).json({ error: "Reviews earn points after the order is fulfilled" }); return;
  }
  const account = await accountFor(parsed.data.phone);
  const reference = `${order.id}:${parsed.data.productSlug}`;
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.id, account.id)).for("update");
    if (!locked) return undefined;
    const [event] = await tx.insert(loyaltyEventsTable).values({
      accountId: locked.id, source: "review", reference, points: 25, status: "approved",
      metadata: { rating: parsed.data.rating, review: parsed.data.review.slice(0, 800), productSlug: parsed.data.productSlug },
    }).onConflictDoNothing().returning();
    if (!event) return undefined;
    const [updated] = await tx.update(loyaltyAccountsTable).set({
      points: locked.points + 25,
      updatedAt: new Date(),
    }).where(eq(loyaltyAccountsTable.id, locked.id)).returning();
    return { event, updated };
  });
  if (!result) { res.status(400).json({ error: "This purchase already has a rewarded review" }); return; }
  const { event, updated } = result;
  res.status(201).json(CreateLoyaltyReviewResponse.parse({ id: event.id, status: "approved", pointsEarned: 25, createdAt: event.createdAt.toISOString(), profile: profileFor(updated, parsed.data.phone, signLoyaltyToken(updated.phoneHash)) }));
});

router.post("/returns", async (req, res): Promise<void> => {
  const parsed = CreateReturnRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the return details" }); return; }
  const order = await verifiedOrder(parsed.data.orderNumber, parsed.data.phone);
  const items = order?.items as Array<{ productSlug: string }> | undefined;
  if (!order || !items?.some((item) => item.productSlug === parsed.data.productSlug)) { res.status(404).json({ error: "Order item not found" }); return; }
  if (order.createdAt.getTime() < Date.now() - 7 * 24 * 60 * 60_000) { res.status(400).json({ error: "The seven-day return window has closed" }); return; }
  if (parsed.data.type === "exchange" && !parsed.data.requestedSize) { res.status(400).json({ error: "Choose the requested exchange size" }); return; }
  const existing = await db.select().from(returnRequestsTable).where(and(eq(returnRequestsTable.orderId, order.id), eq(returnRequestsTable.productSlug, parsed.data.productSlug)));
  if (existing.length) { res.status(400).json({ error: "A request already exists for this item" }); return; }
  const [created] = await db.insert(returnRequestsTable).values({
    requestNumber: `RET-${Date.now().toString().slice(-7)}`, orderId: order.id, orderNumber: order.orderNumber,
    type: parsed.data.type, productSlug: parsed.data.productSlug, reason: parsed.data.reason, requestedSize: parsed.data.requestedSize,
  }).returning();
  res.status(201).json(CreateReturnRequestResponse.parse({ ...created, createdAt: created.createdAt.toISOString() }));
});

router.post("/returns/lookup", async (req, res): Promise<void> => {
  const parsed = LookupReturnRequestsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Check the order details" }); return; }
  const order = await verifiedOrder(parsed.data.orderNumber, parsed.data.phone);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const rows = await db.select().from(returnRequestsTable).where(eq(returnRequestsTable.orderId, order.id));
  res.json(LookupReturnRequestsResponse.parse(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))));
});

router.post("/bundles/quote", async (req, res): Promise<void> => {
  const parsed = QuoteBundleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid cart" }); return; }
  const products = await db.select().from(productsTable);
  const lines = parsed.data.items.map((item) => {
    const product = products.find((row) => row.slug === item.productSlug);
    return product ? { ...item, productName: product.name, unitPrice: Number(product.price) } : null;
  });
  if (lines.some((line) => !line)) { res.status(400).json({ error: "A product is no longer available" }); return; }
  res.json(QuoteBundleResponse.parse(calculateBundle(lines.filter(Boolean) as NonNullable<typeof lines[number]>[])));
});

router.post("/cart-reminders/subscribe", async (req, res): Promise<void> => {
  const parsed = SubscribeCartReminderBody.safeParse(req.body);
  if (!parsed.success || parsed.data.consent !== true) { res.status(400).json({ error: "Explicit reminder consent is required" }); return; }
  try {
    const now = new Date();
    const phoneHash = hashPhone(parsed.data.phone);
    const fingerprint = cartFingerprint(parsed.data.items);
    const [existing] = await db.select().from(cartRemindersTable).where(eq(cartRemindersTable.phoneHash, phoneHash));
    if (existing?.status === "scheduled" && existing.cartFingerprint === fingerprint && existing.reminderAt > now) {
      const reminderToken = existing.publicToken ?? newPublicToken();
      if (!existing.publicToken) await db.update(cartRemindersTable).set({ publicToken: reminderToken }).where(eq(cartRemindersTable.id, existing.id));
      res.json(SubscribeCartReminderResponse.parse({ status: "already_scheduled", reminderAt: existing.reminderAt.toISOString(), nextEligibleAt: existing.nextEligibleAt.toISOString(), reminderToken })); return;
    }
    if (existing?.nextEligibleAt && existing.nextEligibleAt > now) {
      res.setHeader("Retry-After", Math.ceil((existing.nextEligibleAt.getTime() - now.getTime()) / 1000));
      res.status(429).json({ error: "A reminder was recently scheduled. Please wait before trying again." }); return;
    }
    const reminderAt = new Date(now.getTime() + 2 * 60 * 60_000);
    const nextEligibleAt = new Date(now.getTime() + 24 * 60 * 60_000);
    const publicToken = existing?.publicToken ?? newPublicToken();
    const values = { phoneHash, publicToken, encryptedPhone: encryptPhone(parsed.data.phone), channel: parsed.data.channel, cartFingerprint: fingerprint, items: parsed.data.items, consented: true, status: "scheduled", reminderAt, nextEligibleAt, deliveredAt: null, updatedAt: now };
    if (existing) await db.update(cartRemindersTable).set(values).where(eq(cartRemindersTable.id, existing.id));
    else await db.insert(cartRemindersTable).values(values);
    res.json(SubscribeCartReminderResponse.parse({ status: "scheduled", reminderAt: reminderAt.toISOString(), nextEligibleAt: nextEligibleAt.toISOString(), reminderToken: publicToken }));
  } catch { res.status(503).json({ error: "Reminders are temporarily unavailable" }); }
});

router.post("/cart-reminders/unsubscribe", async (req, res): Promise<void> => {
  const parsed = UnsubscribeCartReminderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a valid phone number" }); return; }
  try {
    await db.update(cartRemindersTable).set({ status: "unsubscribed", consented: false, updatedAt: new Date() }).where(eq(cartRemindersTable.publicToken, parsed.data.reminderToken));
    res.json(UnsubscribeCartReminderResponse.parse({ unsubscribed: true }));
  } catch { res.status(400).json({ error: "Enter a valid phone number" }); }
});

router.get("/cart-reminders/:token", async (req, res): Promise<void> => {
  const parsed = GetCartReminderParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid reminder" }); return; }
  const [row] = await db.select().from(cartRemindersTable).where(eq(cartRemindersTable.publicToken, parsed.data.token));
  if (!row) { res.status(404).json({ error: "Reminder not found" }); return; }
  const due = row.status === "scheduled" && row.reminderAt <= new Date();
  res.json(GetCartReminderResponse.parse({ status: due ? "due" : row.status, due, reminderAt: row.reminderAt.toISOString() }));
});

router.post("/cart-reminders/:token/delivered", async (req, res): Promise<void> => {
  const parsed = MarkCartReminderDeliveredParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid reminder" }); return; }
  await db.update(cartRemindersTable).set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() }).where(and(eq(cartRemindersTable.publicToken, parsed.data.token), eq(cartRemindersTable.status, "scheduled")));
  res.json(MarkCartReminderDeliveredResponse.parse({ unsubscribed: true }));
});

export default router;