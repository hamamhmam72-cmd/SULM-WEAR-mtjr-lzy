import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type CartLineInput = { productSlug: string; size: string; quantity: number };
export type PricedLine = CartLineInput & { productName: string; unitPrice: number };

export const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a valid phone number");
  return digits;
};

export const hashPhone = (phone: string): string =>
  createHash("sha256").update(normalizePhone(phone)).digest("hex");

export const maskPhone = (phone: string): string => `•••• ${normalizePhone(phone).slice(-4)}`;

export const encryptPhone = (phone: string): string => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Reminder encryption is unavailable");
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalizePhone(phone), "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
};

const signingKey = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Verification is unavailable");
  return secret;
};

export const signLoyaltyToken = (phoneHash: string): string => {
  const payload = Buffer.from(JSON.stringify({ phoneHash, exp: Date.now() + 15 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

export const verifyLoyaltyToken = (token: string): { phoneHash: string } => {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid verification");
  const expected = createHmac("sha256", signingKey()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Invalid verification");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { phoneHash: string; exp: number };
  if (data.exp < Date.now()) throw new Error("Verification expired");
  return { phoneHash: data.phoneHash };
};

export const newPublicToken = (): string => randomBytes(24).toString("base64url");

export const cartFingerprint = (items: CartLineInput[]): string =>
  createHash("sha256")
    .update(JSON.stringify([...items].sort((a, b) => a.productSlug.localeCompare(b.productSlug))))
    .digest("hex");

export const calculateBundle = (lines: PricedLine[]) => {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const slugs = new Set(lines.map((line) => line.productSlug));
  let discount = 0;
  let appliedRule: string | null = null;
  if (slugs.has("the-overshirt") && slugs.has("axis-cargo")) {
    const eligible = lines.filter((line) => ["the-overshirt", "axis-cargo"].includes(line.productSlug));
    discount = Math.min(...eligible.map((line) => line.unitPrice)) * 0.2;
    appliedRule = "SULM Set — 20% off the lower-priced piece";
  } else if (lines.reduce((sum, line) => sum + line.quantity, 0) >= 3) {
    discount = subtotal * 0.1;
    appliedRule = "Three-piece edit — 10% off";
  }
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number((subtotal - discount).toFixed(2)),
    appliedRule,
  };
};