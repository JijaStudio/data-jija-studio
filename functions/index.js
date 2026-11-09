const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const crypto = require("node:crypto");

initializeApp({ databaseURL: "https://jija-7c104-default-rtdb.firebaseio.com" });
const db = getDatabase();
const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const WHATSAPP_TOKEN = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_STORE_NUMBER = defineSecret("WHATSAPP_STORE_NUMBER");
const WHATSAPP_ORDER_TEMPLATE = defineSecret("WHATSAPP_ORDER_TEMPLATE");
const WHATSAPP_CUSTOMER_TEMPLATE = defineSecret("WHATSAPP_CUSTOMER_TEMPLATE");
const REGION = "asia-south1";
const allowedOrigins = new Set(["https://jijastudio.github.io","https://jijastudio.in","https://www.jijastudio.in"]);

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (allowedOrigins.has(origin)) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Razorpay-Signature");
  if (req.method === "OPTIONS") { res.status(204).send(""); return true; }
  return false;
}
function jsonError(res, code, message) { return res.status(code).json({ error: message }); }
function hmac(value, secret) { return crypto.createHmac("sha256", secret).update(value).digest("hex"); }
function timingSafeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")); } catch { return false; }
}
function cleanText(value, max = 300) { return String(value || "").trim().slice(0, max); }
function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  throw new Error("Enter a valid phone number with country code.");
}
async function razorpayRequest(path, method, body) {
  const auth = Buffer.from(RAZORPAY_KEY_ID.value() + ":" + RAZORPAY_KEY_SECRET.value()).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1" + path, {
    method, headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.description || "Razorpay request failed.");
  return data;
}
async function getCatalog() {
  const snap = await db.ref("products").get();
  const raw = snap.exists() ? snap.val() : [];
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  return list.filter(p => p && typeof p === "object" && !p._deleted && p.published !== false && p.placeholder !== true);
}
async function computeOrder(body) {
  const customer = {
    name: cleanText(body.customer?.name, 100),
    phone: normalizePhone(body.customer?.phone),
    address: cleanText(body.customer?.address, 500),
    pin: cleanText(body.customer?.pin, 6)
  };
  if (!customer.name || !customer.address || !/^\d{6}$/.test(customer.pin)) throw new Error("Enter your name, full address and a valid six-digit PIN code.");
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) throw new Error("Your shopping bag is empty or invalid.");
  const catalog = await getCatalog();
  const byId = new Map(catalog.map(p => [String(p.id), p]));
  const items = [];
  for (const row of body.items) {
    const p = byId.get(String(row.id));
    const qty = Math.floor(Number(row.quantity));
    if (!p || !Number.isFinite(qty) || qty < 1 || qty > 20) throw new Error("A product is no longer available. Refresh your bag and try again.");
    const size = cleanText(row.size || "One Size", 80);
    const colour = cleanText(row.colour || "", 80);
    const price = Math.max(0, Math.round(Number(p.salePrice > 0 ? p.salePrice : p.price) || 0));
    if (price <= 0) throw new Error("A product has an invalid price. Please contact the store.");
    if (p.stockBySize && Object.keys(p.stockBySize).length) {
      if (Number(p.stockBySize[size] || 0) < qty) throw new Error("Insufficient stock for " + cleanText(p.name, 100) + " (" + size + ").");
    } else if (Number.isFinite(Number(p.stock)) && Number(p.stock) < qty) {
      throw new Error("Insufficient stock for " + cleanText(p.name, 100) + ".");
    }
    items.push({ productId: String(p.id), name: cleanText(p.name, 120), size, colour, quantity: qty, unitPrice: price, lineTotal: price * qty, image: cleanText(p.image || "", 500) });
  }
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const settingsSnap = await db.ref("settings").get();
  const settings = settingsSnap.exists() ? settingsSnap.val() || {} : {};
  const threshold = Math.max(0, Number(settings.freeShippingThreshold ?? 3500) || 0);
  const fee = Math.max(0, Number(settings.shippingFee ?? 50) || 0);
  const shipping = subtotal >= threshold ? 0 : fee;
  return { customer, items, subtotal, shipping, total: subtotal + shipping };
}
async function sendWhatsAppTemplate(to, templateName, order) {
  if (!templateName || !WHATSAPP_TOKEN.value() || !WHATSAPP_PHONE_NUMBER_ID.value()) throw new Error("WhatsApp Cloud API or approved template is not configured.");
  const body = { messaging_product: "whatsapp", to, type: "template", template: {
    name: templateName, language: { code: "en" },
    components: [{ type: "body", parameters: [
      { type: "text", text: order.orderNumber || order.id },
      { type: "text", text: order.customer.name },
      { type: "text", text: "₹" + Number(order.total || 0).toLocaleString("en-IN") }
    ] }]
  } };
  const response = await fetch("https://graph.facebook.com/v22.0/" + WHATSAPP_PHONE_NUMBER_ID.value() + "/messages", {
    method: "POST", headers: { Authorization: "Bearer " + WHATSAPP_TOKEN.value(), "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("WhatsApp Cloud API returned " + response.status);
}
async function notifyOrderOnce(orderId) {
  const orderRef = db.ref("orders/" + orderId);
  let shouldSend = false;
  await orderRef.transaction(current => {
    if (!current || current.paymentStatus !== "paid" || current.whatsappNotificationStatus === "sent" || current.whatsappNotificationStatus === "sending") return;
    current.whatsappNotificationStatus = "sending";
    return current;
  }, (error, committed) => { if (!error && committed) shouldSend = true; }, false);
  if (!shouldSend) return;
  const snap = await orderRef.get();
  const order = snap.val();
  try {
    const storeNumber = WHATSAPP_STORE_NUMBER.value().replace(/\D/g, "");
    if (!storeNumber) throw new Error("Store WhatsApp number is not configured.");
    await sendWhatsAppTemplate(storeNumber, WHATSAPP_ORDER_TEMPLATE.value(), order);
    await sendWhatsAppTemplate(order.customer.phone, WHATSAPP_CUSTOMER_TEMPLATE.value(), order);
    await orderRef.update({ whatsappNotificationStatus: "sent", whatsappNotifiedAt: Date.now() });
  } catch (error) {
    console.error("WhatsApp notification failed for order", orderId, error.message);
    await orderRef.update({ whatsappNotificationStatus: "failed" });
  }
}
async function markPaid(internalOrderId, paymentId) {
  const ref = db.ref("orders/" + internalOrderId);
  const snap = await ref.get();
  if (!snap.exists()) throw new Error("Order record not found.");
  const order = snap.val();
  const payment = await razorpayRequest("/payments/" + encodeURIComponent(paymentId), "GET");
  if (payment.status !== "captured" || payment.order_id !== order.razorpayOrderId || Number(payment.amount) !== Number(order.amountPaise) || payment.currency !== "INR") throw new Error("Payment is not captured for this order.");
  await ref.transaction(current => {
    if (!current) return;
    if (current.paymentStatus === "paid") return current;
    current.paymentStatus = "paid"; current.orderStatus = "confirmed";
    current.razorpayPaymentId = paymentId; current.paidAt = Date.now();
    return current;
  });
  await notifyOrderOnce(internalOrderId);
  return { orderId: internalOrderId, orderNumber: order.orderNumber, paymentStatus: "paid" };
}
exports.createRazorpayOrder = onRequest({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], cors: false }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
  try {
    const paymentSettingsSnap = await db.ref("settings/paymentSettings").get();
    const paymentSettings = paymentSettingsSnap.exists() ? (paymentSettingsSnap.val() || {}) : {};
    if (paymentSettings.razorpayEnabled === false) return jsonError(res, 403, "Online Razorpay payment is disabled by the store administrator.");
    const orderData = await computeOrder(req.body || {});
    const internalId = db.ref("orders").push().key;
    const orderNumber = "JJS-" + Date.now().toString().slice(-8) + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
    const amountPaise = Math.round(orderData.total * 100);
    const rpOrder = await razorpayRequest("/orders", "POST", { amount: amountPaise, currency: "INR", receipt: internalId.slice(0, 40), notes: { internalOrderId: internalId, orderNumber, store: "Jija Studio" } });
    const record = { ...orderData, id: internalId, orderNumber, currency: "INR", amountPaise, razorpayOrderId: rpOrder.id, paymentStatus: "pending", orderStatus: "payment_pending", createdAt: Date.now(), whatsappNotificationStatus: "not_configured" };
    await db.ref("orders/" + internalId).set(record);
    return res.status(200).json({ keyId: RAZORPAY_KEY_ID.value(), orderId: internalId, orderNumber, razorpayOrderId: rpOrder.id, amount: amountPaise, currency: "INR", customer: { name: orderData.customer.name, phone: orderData.customer.phone } });
  } catch (error) {
    console.error("createRazorpayOrder failed:", error);
    return jsonError(res, 400, error.message || "Could not create checkout.");
  }
});
exports.verifyRazorpayPayment = onRequest({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET], cors: false }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return jsonError(res, 400, "Missing payment verification fields.");
    const snap = await db.ref("orders/" + String(orderId)).get();
    if (!snap.exists()) return jsonError(res, 404, "Order record not found.");
    if (snap.val().razorpayOrderId !== razorpay_order_id) return jsonError(res, 400, "Order mismatch.");
    const expected = hmac(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET.value());
    if (!timingSafeHexEqual(expected, razorpay_signature)) return jsonError(res, 400, "Payment signature verification failed.");
    return res.status(200).json(await markPaid(String(orderId), String(razorpay_payment_id)));
  } catch (error) {
    console.error("verifyRazorpayPayment failed:", error);
    return jsonError(res, 400, error.message || "Could not verify payment.");
  }
});
exports.razorpayWebhook = onRequest({ region: REGION, secrets: [RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET], cors: false }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed.");
  const signature = req.get("X-Razorpay-Signature") || "";
  const expected = hmac(req.rawBody, RAZORPAY_WEBHOOK_SECRET.value());
  if (!timingSafeHexEqual(expected, signature)) return res.status(401).send("Invalid webhook signature.");
  try {
    const event = req.body || {};
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const internalId = payment?.notes?.internalOrderId;
      if (internalId && payment?.id) await markPaid(String(internalId), String(payment.id));
    }
    return res.status(200).send("ok");
  } catch (error) {
    console.error("razorpayWebhook failed:", error);
    return res.status(500).send("Retry");
  }
});

exports.getOrderStatus = onRequest({ region: REGION, cors: false }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");
  try {
    const orderId = cleanText(req.body?.orderId, 120);
    if (!orderId) return jsonError(res, 400, "Order ID is required.");
    const snap = await db.ref("orders/" + orderId).get();
    if (!snap.exists()) return jsonError(res, 404, "Order not found.");
    const order = snap.val();
    return res.status(200).json({ orderId, orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus });
  } catch (error) {
    console.error("getOrderStatus failed:", error);
    return jsonError(res, 500, "Could not check order status.");
  }
});
