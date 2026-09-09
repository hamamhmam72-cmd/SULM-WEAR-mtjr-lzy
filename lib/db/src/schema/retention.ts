import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const loyaltyAccountsTable = pgTable("sulm_loyalty_accounts", {
  id: serial("id").primaryKey(),
  phoneHash: text("phone_hash").notNull().unique(),
  phoneLastFour: text("phone_last_four").notNull(),
  points: integer("points").notNull().default(0),
  pendingPoints: integer("pending_points").notNull().default(0),
  walletCredit: numeric("wallet_credit", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyEventsTable = pgTable("sulm_loyalty_events", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  source: text("source").notNull(),
  reference: text("reference").notNull(),
  points: integer("points").notNull(),
  status: text("status").notNull().default("approved"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sulm_loyalty_source_reference_idx").on(table.source, table.reference)]);

export const returnRequestsTable = pgTable("sulm_return_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  orderId: integer("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  type: text("type").notNull(),
  productSlug: text("product_slug").notNull(),
  reason: text("reason").notNull(),
  requestedSize: text("requested_size"),
  status: text("status").notNull().default("requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sulm_return_order_product_idx").on(table.orderId, table.productSlug)]);

export const cartRemindersTable = pgTable("sulm_cart_reminders", {
  id: serial("id").primaryKey(),
  phoneHash: text("phone_hash").notNull().unique(),
  publicToken: text("public_token"),
  encryptedPhone: text("encrypted_phone").notNull(),
  channel: text("channel").notNull(),
  cartFingerprint: text("cart_fingerprint").notNull(),
  items: jsonb("items").notNull(),
  consented: boolean("consented").notNull().default(false),
  status: text("status").notNull().default("scheduled"),
  reminderAt: timestamp("reminder_at", { withTimezone: true }).notNull(),
  nextEligibleAt: timestamp("next_eligible_at", { withTimezone: true }).notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});