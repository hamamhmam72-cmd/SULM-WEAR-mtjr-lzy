import { Router, type IRouter } from "express";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  GetProductParams,
  GetProductResponse,
  GetProductsQueryParams,
  GetProductsResponse,
  GetStorefrontSummaryResponse,
} from "@workspace/api-zod";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();

const seedProducts = [
  {
    slug: "the-overshirt",
    name: "The Overshirt",
    nameAr: "الأوفرشيرت",
    category: "Outerwear",
    price: "49.00",
    compareAtPrice: "59.00",
    description: "A structured overshirt cut for movement, layering, and long nights.",
    descriptionAr: "أوفرشيرت بقصة هندسية للحركة والطبقات وإطلالة تدوم.",
    image: "/images/sulm-overshirt.png",
    accent: "#9ca3af",
    sizes: ["S", "M", "L", "XL"],
    stock: 18,
    featured: true,
    story: "Designed in Amman and refined for everyday motion. Dense cotton with a clean silver hardware finish.",
  },
  {
    slug: "axis-cargo",
    name: "Axis Cargo",
    nameAr: "بنطال آكسس",
    category: "Bottoms",
    price: "44.00",
    compareAtPrice: null,
    description: "Relaxed cargo trousers with a precise line and adaptable fit.",
    descriptionAr: "بنطال كارغو بقصة مريحة وخط دقيق وملاءمة قابلة للتكيف.",
    image: "/images/sulm-cargo.png",
    accent: "#64748b",
    sizes: ["S", "M", "L", "XL"],
    stock: 12,
    featured: true,
    story: "Built around useful pockets and a composed silhouette. Made to be worn hard and kept close.",
  },
  {
    slug: "mono-hoodie",
    name: "Mono Hoodie",
    nameAr: "هودي مونو",
    category: "Essentials",
    price: "39.00",
    compareAtPrice: null,
    description: "A heavyweight essential with a quiet profile and silver detail.",
    descriptionAr: "قطعة أساسية ثقيلة بملامح هادئة وتفاصيل فضية.",
    image: "/images/sulm-hoodie.png",
    accent: "#d1d5db",
    sizes: ["S", "M", "L", "XL", "XXL"],
    stock: 24,
    featured: true,
    story: "Soft on the inside, deliberate on the outside. The layer that anchors the whole wardrobe.",
  },
  {
    slug: "frame-tee",
    name: "Frame Tee",
    nameAr: "تيشيرت فريم",
    category: "Essentials",
    price: "24.00",
    compareAtPrice: null,
    description: "A substantial everyday tee with a sharper shoulder and a softer hand.",
    descriptionAr: "تيشيرت يومي متين بكتف واضح وملمس ناعم.",
    image: "/images/sulm-hoodie.png",
    accent: "#475569",
    sizes: ["S", "M", "L", "XL"],
    stock: 31,
    featured: false,
    story: "The first layer in the SULM uniform: uncomplicated, durable, and never anonymous.",
  },
];

const ensureSeeded = async (): Promise<void> => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable);
  if (count > 0) return;
  await db.insert(productsTable).values(seedProducts).onConflictDoNothing();
};

const toProduct = (product: typeof productsTable.$inferSelect) => ({
  ...product,
  price: Number(product.price),
  compareAtPrice:
    product.compareAtPrice == null ? null : Number(product.compareAtPrice),
  createdAt: undefined,
});

router.get("/storefront/summary", async (req, res): Promise<void> => {
  await ensureSeeded();
  const [{ productCount }] = await db
    .select({ productCount: sql<number>`count(*)::int` })
    .from(productsTable);
  const data = {
    productCount,
    customerCount: 240,
    shippingPromise: "Free delivery across Jordan on orders over 50 JOD",
    instagramUrl: "https://www.instagram.com/sulm_wear?stkn=MTRlend5dHM3emxkeQ==",
    phone: "+962 7 8667 7153",
  };
  res.json(GetStorefrontSummaryResponse.parse(data));
});

router.get("/products", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = GetProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category, search, featured } = parsed.data;
  const filters = [];
  if (category) filters.push(eq(productsTable.category, category));
  if (featured !== undefined) filters.push(eq(productsTable.featured, featured));
  if (search) {
    filters.push(
      sql`(${ilike(productsTable.name, `%${search}%`)} OR ${ilike(productsTable.nameAr, `%${search}%`)})`,
    );
  }
  const rows = await db
    .select()
    .from(productsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(productsTable.featured, productsTable.createdAt);
  res.json(GetProductsResponse.parse(rows.map(toProduct)));
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  await ensureSeeded();
  const parsed = GetProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.slug, parsed.data.slug));
  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(GetProductResponse.parse(toProduct(row)));
});

export default router;