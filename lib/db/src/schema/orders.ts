import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("sulm_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("new"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  bundleDiscount: numeric("bundle_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  walletCreditUsed: numeric("wallet_credit_used", { precision: 10, scale: 2 }).notNull().default("0"),
  loyaltyPointsEarned: integer("loyalty_points_earned").notNull().default(0),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  items: jsonb("items").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;