import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  db,
  inventoryLogsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
} from "@workspace/db";
import { transitionOrder } from "../src/lib/fulfillment";

const suffix = `${Date.now()}-${process.pid}`;
let productId: number | undefined;
let orderId: number | undefined;

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
    stock: 12,
    featured: false,
    story: "Temporary",
    status: "draft",
  }).returning();
  productId = product.id;

  const [first, second] = await db.insert(productVariantsTable).values([
    { productId, sku: `TEST-A-${suffix}`, colorName: "Black", colorHex: "#000000", size: "M", stock: 5, initialStock: 5 },
    { productId, sku: `TEST-B-${suffix}`, colorName: "Silver", colorHex: "#c0c0c0", size: "M", stock: 7, initialStock: 7 },
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
  console.log("Fulfillment integration test passed");
} finally {
  if (orderId) await db.delete(inventoryLogsTable).where(eq(inventoryLogsTable.orderId, orderId));
  if (orderId) await db.delete(ordersTable).where(eq(ordersTable.id, orderId));
  if (productId) await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, productId));
  if (productId) await db.delete(productsTable).where(eq(productsTable.id, productId));
}