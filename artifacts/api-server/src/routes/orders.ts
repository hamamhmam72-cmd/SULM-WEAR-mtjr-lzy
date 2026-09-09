import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  LookupOrderQueryParams,
  LookupOrderResponse,
} from "@workspace/api-zod";
import { db, ordersTable, productsTable } from "@workspace/db";
import { logger } from "../lib/logger";

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
  total: Number(order.total),
  items: order.items as OrderLine[],
  createdAt: order.createdAt.toISOString(),
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid order request");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, phone, city, address, paymentMethod, items } = parsed.data;
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

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const orderNumber = `SULM-${Date.now().toString().slice(-7)}`;
  const [created] = await db
    .insert(ordersTable)
    .values({
      orderNumber,
      customerName,
      phone,
      city,
      address,
      paymentMethod,
      status: "new",
      total: total.toFixed(2),
      items: lines,
    })
    .returning();

  req.log.info({ orderNumber: created.orderNumber, total }, "Order created");
  res.status(201).json(CreateOrderResponse.parse(toOrder(created)));
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