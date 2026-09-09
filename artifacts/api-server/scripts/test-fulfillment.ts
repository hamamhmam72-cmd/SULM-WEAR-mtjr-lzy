import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  inventoryLogsTable,
  loyaltyAccountsTable,
  loyaltyEventsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
} from "@workspace/db";
import { transitionOrder } from "../src/lib/fulfillment";
import { saveProduct } from "../src/routes/admin";

const suffix = `${Date.now()}-${process.pid}`;
let productId: number | undefined;
let orderId: number | undefined;
let canceledOrderId: number | undefined;
let loyaltyAccountId: number | undefined;
const concurrentOrderIds: number[] = [];

try {
  const [product] = await db.insert(productsTable).values({
    slug: `fulfillment-test-${suffix}`,
    name: "Fulfillment Test",
    nameAr: "اختبار",
    category: "Test",
    price: "10.00",
    description: "Temporary integration-test product",
    descriptionAr: "اختبار مؤقت",
    image: "/images/test.jpg",
    accent: "#000000",
    sizes: ["M"],
    stock: 19,
    featured: false,
    story: "Temporary",
    status: "draft",
  }).returning();
  productId = product.id;

  const [first, second, raceVariant, overdrawVariant] = await db.insert(productVariantsTable).values([
    { productId, sku: `TEST-A-${suffix}`, colorName: "Black", colorHex: "#000000", size: "M", stock: 5, initialStock: 5 },
    { productId, sku: `TEST-B-${suffix}`, colorName: "Silver", colorHex: "#c0c0c0", size: "M", stock: 7, initialStock: 7 },
    { productId, sku: `TEST-RACE-${suffix}`, colorName: "Race", colorHex: "#808080", size: "M", stock: 4, initialStock: 4 },
    { productId, sku: `TEST-OVERDRAW-${suffix}`, colorName: "Overdraw", colorHex: "#404040", size: "M", stock: 3, initialStock: 3 },
  ]).returning();

  const [order] = await db.insert(ordersTable).values({
    orderNumber: `TEST-${suffix}`,
    customerName: "Integration Test",
    phone: "+962700000000",
    city: "Amman",
    address: "Temporary",
    paymentMethod: "cod",
    status: "new",
    subtotal: "20.00",
    total: "20.00",
    items: [{
      productName: product.name,
      productSlug: product.slug,
      variantId: second.id,
      sku: second.sku,
      colorName: second.colorName,
      colorHex: second.colorHex,
      size: second.size,
      quantity: 2,
      unitPrice: 10,
    }],
  }).returning();
  orderId = order.id;

  await assert.rejects(
    db.transaction((tx) => transitionOrder(tx, order.id, "packed", "integration-test")),
    /Illegal transition/,
  );
  for (const status of ["confirmed", "processing", "packed"] as const) {
    await db.transaction((tx) => transitionOrder(tx, order.id, status, "integration-test"));
  }
  await db.transaction((tx) => transitionOrder(tx, order.id, "packed", "integration-test"));

  const [firstAfter] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, first.id));
  const [secondAfter] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, second.id));
  const logs = await db.select().from(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, order.id));
  assert.equal(firstAfter.stock, 5, "unselected color must not change");
  assert.equal(secondAfter.stock, 5, "selected variant must decrement exactly once");
  assert.equal(logs.length, 1, "one authoritative inventory log is required");
  assert.equal(logs[0].delta, -2);

  const staleCatalogInput = {
    slug: product.slug,
    name: product.name,
    nameAr: product.nameAr,
    category: product.category,
    price: Number(product.price),
    compareAtPrice: null,
    description: product.description,
    descriptionAr: product.descriptionAr,
    image: product.image,
    accent: product.accent,
    featured: product.featured,
    story: product.story,
    status: product.status,
    variants: [first, second, raceVariant, overdrawVariant].map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size: variant.size,
      price: null,
      compareAtPrice: null,
      stock: variant.stock,
      expectedStock: variant.stock,
      chestMm: null,
      lengthMm: null,
      shouldersMm: null,
      sleevesMm: null,
      media: [],
      active: true,
    })),
  };

  const concurrentOrders = await db.insert(ordersTable).values([1, 2].map((number) => ({
    orderNumber: `RACE-${number}-${suffix}`,
    customerName: `Concurrent Test ${number}`,
    phone: `+96270000000${number + 1}`,
    city: "Amman",
    address: "Temporary",
    paymentMethod: "cod",
    status: "new",
    subtotal: "20.00",
    total: "20.00",
    items: [{
      productName: product.name,
      productSlug: product.slug,
      variantId: raceVariant.id,
      sku: raceVariant.sku,
      colorName: raceVariant.colorName,
      colorHex: raceVariant.colorHex,
      size: raceVariant.size,
      quantity: 2,
      unitPrice: 10,
    }],
  }))).returning();
  concurrentOrderIds.push(...concurrentOrders.map((row) => row.id));
  for (const concurrentOrder of concurrentOrders) {
    await db.transaction((tx) => transitionOrder(tx, concurrentOrder.id, "confirmed", "integration-test"));
    await db.transaction((tx) => transitionOrder(tx, concurrentOrder.id, "processing", "integration-test"));
  }

  await Promise.all(concurrentOrders.map((concurrentOrder) =>
    db.transaction((tx) => transitionOrder(tx, concurrentOrder.id, "packed", "integration-test")),
  ));
  await Promise.all(concurrentOrders.map((concurrentOrder) =>
    db.transaction((tx) => transitionOrder(tx, concurrentOrder.id, "packed", "integration-test")),
  ));

  const [raceAfter] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, raceVariant.id));
  assert.equal(raceAfter.stock, 0, "concurrent packing must never take stock below zero");
  for (const concurrentOrder of concurrentOrders) {
    const orderLogs = await db.select().from(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, concurrentOrder.id));
    assert.equal(orderLogs.length, 1, "each order and variant must have one inventory log");
    assert.equal(orderLogs[0].variantId, raceVariant.id);
    assert.equal(orderLogs[0].delta, -2);
  }

  const overdrawOrders = await db.insert(ordersTable).values([1, 2].map((number) => ({
    orderNumber: `OVERDRAW-${number}-${suffix}`,
    customerName: `Overdraw Test ${number}`,
    phone: `+96270000001${number}`,
    city: "Amman",
    address: "Temporary",
    paymentMethod: "cod",
    status: "new",
    subtotal: "20.00",
    total: "20.00",
    items: [{
      productName: product.name,
      productSlug: product.slug,
      variantId: overdrawVariant.id,
      sku: overdrawVariant.sku,
      colorName: overdrawVariant.colorName,
      colorHex: overdrawVariant.colorHex,
      size: overdrawVariant.size,
      quantity: 2,
      unitPrice: 10,
    }],
  }))).returning();
  concurrentOrderIds.push(...overdrawOrders.map((row) => row.id));
  for (const overdrawOrder of overdrawOrders) {
    await db.transaction((tx) => transitionOrder(tx, overdrawOrder.id, "confirmed", "integration-test"));
    await db.transaction((tx) => transitionOrder(tx, overdrawOrder.id, "processing", "integration-test"));
  }
  const overdrawResults = await Promise.allSettled(overdrawOrders.map((overdrawOrder) =>
    db.transaction((tx) => transitionOrder(tx, overdrawOrder.id, "packed", "integration-test")),
  ));
  assert.equal(overdrawResults.filter((result) => result.status === "fulfilled").length, 1, "only one oversubscribed order may pack");
  assert.equal(overdrawResults.filter((result) => result.status === "rejected").length, 1, "one oversubscribed order must be rejected");
  const [overdrawAfter] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, overdrawVariant.id));
  assert.equal(overdrawAfter.stock, 1, "oversubscribed packing must preserve non-negative stock");
  const overdrawLogCounts = await Promise.all(overdrawOrders.map(async (overdrawOrder) =>
    (await db.select().from(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, overdrawOrder.id))).length,
  ));
  assert.deepEqual(overdrawLogCounts.sort(), [0, 1], "only the successfully packed order may write a ledger row");

  await assert.rejects(
    saveProduct(staleCatalogInput, product.id, "integration-test"),
    /Stock changed/,
    "a stale catalog form must not overwrite concurrently deducted inventory",
  );
  const [raceAfterStaleEdit] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, raceVariant.id));
  assert.equal(raceAfterStaleEdit.stock, 0, "rejected stale catalog edit must roll back completely");

  const [account] = await db.insert(loyaltyAccountsTable).values({
    phoneHash: `fulfillment-test-${suffix}`,
    phoneLastFour: "0000",
    pendingPoints: 20,
    walletCredit: "0.00",
  }).returning();
  loyaltyAccountId = account.id;
  const [cancelOrder] = await db.insert(ordersTable).values({
    orderNumber: `CANCEL-${suffix}`,
    customerName: "Cancellation Test",
    phone: "+962700000001",
    city: "Amman",
    address: "Temporary",
    paymentMethod: "cod",
    status: "new",
    subtotal: "10.00",
    walletCreditUsed: "3.00",
    total: "7.00",
    items: [{
      productName: product.name,
      productSlug: product.slug,
      variantId: first.id,
      sku: first.sku,
      colorName: first.colorName,
      colorHex: first.colorHex,
      size: first.size,
      quantity: 1,
      unitPrice: 10,
    }],
  }).returning();
  canceledOrderId = cancelOrder.id;
  const [event] = await db.insert(loyaltyEventsTable).values({
    accountId: account.id,
    source: "purchase",
    reference: cancelOrder.orderNumber,
    points: 20,
    status: "pending",
  }).returning();
  await db.transaction((tx) => transitionOrder(tx, cancelOrder.id, "canceled", "integration-test"));
  await db.transaction((tx) => transitionOrder(tx, cancelOrder.id, "canceled", "integration-test"));
  const [accountAfter] = await db.select().from(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.id, account.id));
  const [eventAfter] = await db.select().from(loyaltyEventsTable).where(eq(loyaltyEventsTable.id, event.id));
  assert.equal(Number(accountAfter.walletCredit), 3, "cancellation must refund wallet credit once");
  assert.equal(accountAfter.pendingPoints, 0, "cancellation must remove pending purchase points");
  assert.equal(eventAfter.status, "canceled", "purchase event must be canceled");
  console.log("Fulfillment integration test passed");
} finally {
  if (loyaltyAccountId) await db.delete(loyaltyEventsTable).where(eq(loyaltyEventsTable.accountId, loyaltyAccountId));
  if (canceledOrderId) await db.delete(ordersTable).where(eq(ordersTable.id, canceledOrderId));
  if (loyaltyAccountId) await db.delete(loyaltyAccountsTable).where(eq(loyaltyAccountsTable.id, loyaltyAccountId));
  if (orderId) await db.delete(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, orderId));
  for (const concurrentOrderId of concurrentOrderIds) {
    await db.delete(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, concurrentOrderId));
  }
  if (concurrentOrderIds.length) await db.delete(ordersTable).where(inArray(ordersTable.id, concurrentOrderIds));
  if (orderId) await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
  if (productId) await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  if (productId) await db.delete(productsTable).where(eq(productsTable.id, productId));
}