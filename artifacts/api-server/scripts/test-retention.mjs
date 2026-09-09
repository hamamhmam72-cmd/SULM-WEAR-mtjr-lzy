const base = process.env.API_URL ?? "http://localhost:80/api";
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error("SESSION_SECRET is required");

const post = async (path, body, headers = {}) => {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const suffix = String(Date.now()).slice(-7);
const phone = `96279${suffix}`;
const order = await post("/orders", {
  customerName: "Retention Test",
  phone,
  city: "Amman",
  address: "Automated test address",
  paymentMethod: "cod",
  items: [{ productSlug: "the-overshirt", size: "M", quantity: 1 }],
});
assert(order.status === 201, "Order setup failed");

const reviewBody = {
  orderNumber: order.data.orderNumber,
  phone,
  productSlug: "the-overshirt",
  rating: 5,
  review: "A verified automated retention test review.",
};
const unpaid = await post("/loyalty/reviews", reviewBody);
assert(unpaid.status === 400, "Unpaid orders must not earn review points");

const complete = await post(`/orders/${order.data.orderNumber}/complete`, undefined, {
  "x-internal-secret": secret,
});
assert(complete.status === 200, "Trusted completion failed");
const approved = await post("/loyalty/reviews", reviewBody);
assert(approved.status === 201 && approved.data.pointsEarned === 25, "Fulfilled review reward failed");
const duplicateReview = await post("/loyalty/reviews", reviewBody);
assert(duplicateReview.status === 400, "Duplicate review reward was not blocked");

const reminderPhone = `96278${suffix}`;
const reminderBody = {
  phone: reminderPhone,
  consent: true,
  channel: "in_app",
  items: [{ productSlug: "mono-hoodie", size: "M", quantity: 1 }],
};
const first = await post("/cart-reminders/subscribe", reminderBody);
assert(first.status === 200 && first.data.reminderToken, "Initial reminder scheduling failed");
const duplicate = await post("/cart-reminders/subscribe", reminderBody);
assert(duplicate.status === 200 && duplicate.data.status === "already_scheduled", "Duplicate reminder was not deduplicated");
const delivered = await post(`/cart-reminders/${first.data.reminderToken}/delivered`, undefined);
assert(delivered.status === 200, "Reminder delivery transition failed");
const unsubscribed = await post("/cart-reminders/unsubscribe", { reminderToken: first.data.reminderToken });
assert(unsubscribed.status === 200, "Reminder unsubscribe failed");
const limited = await post("/cart-reminders/subscribe", reminderBody);
assert(limited.status === 429, "Reminder frequency limit was not enforced");

console.log("Retention integration checks passed");