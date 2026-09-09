import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { ordersTable } from "./orders";

export const productVariantsTable = pgTable("sulm_product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  colorName: text("color_name").notNull(),
  colorHex: text("color_hex").notNull(),
  size: text("size").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  initialStock: integer("initial_stock").notNull().default(0),
  chestMm: integer("chest_mm"),
  lengthMm: integer("length_mm"),
  shouldersMm: integer("shoulders_mm"),
  sleevesMm: integer("sleeves_mm"),
  media: text("media").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sulm_variant_product_color_size_idx").on(table.productId, table.colorName, table.size),
]);

export const inventoryLogsTable = pgTable("sulm_inventory_logs", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => productVariantsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  actorUserId: text("actor_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogsTable = pgTable("sulm_admin_audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});