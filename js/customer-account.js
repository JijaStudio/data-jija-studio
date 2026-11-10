import { auth } from "./firebase-config.js";
import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = id => document.getElementById(id);
const accountApi = () => window.JijaCustomerAuth;
let confirmationResult = null;
let recaptchaVerifier = null;
let loadedUid = "";
let orderRefreshTimer = null;
let orderLoadInProgress = false;
const expandedTrackOrders = new Set();
const params = new URLSearchParams(location.search);
const returnTo = params.get("return") === "cart.html" ? "cart.html" : params.get("return") === "shop.html" ? "shop.html" : "";
$("continue-shopping").href = returnTo || "shop.html";
$("continue-shopping").textContent = returnTo === "cart.html" ? "Continue to checkout" : "Continue shopping";

function sayLogin(message) { $("login-status").textContent = message || ""; }
function sayProfile(message) { $("profile-status").textContent = message || ""; }
function normalizeIndianPhone(value) {
  const original = String(value || "").trim();
  const digits = original.replace(/[^0-9]/g, "");
  if (/^\d{10}$/.test(digits)) return "+91" + digits;
  if (/^91\d{10}$/.test(digits)) return "+" + digits;
  if (/^\+91\d{10}$/.test(original.replace(/[\s()-]/g, ""))) return original.replace(/[\s()-]/g, "");
  throw new Error("Enter a valid Indian mobile number with 10 digits, or include +91.");
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
const money = value => new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value)||0);
const statusLabels = {
  pending_confirmation: "Order request received · awaiting confirmation",
  payment_pending: "Payment confirmation pending",
  confirmed: "Order confirmed",
  processing: "Processing your order",
  packed: "Packed and ready to ship",
  shipped: "Shipped · in transit",
  delivered: "Delivered",
  cancelled: "Cancelled"
};
function orderStatus(order) {
  if (order.orderStatus === "cancelled") return "cancelled";
  if (order.paymentStatus === "whatsapp_requested" && (!order.orderStatus || order.orderStatus === "pending_confirmation")) return "pending_confirmation";
  if (order.paymentStatus === "created") return "payment_pending";
  return order.orderStatus || (order.paymentStatus === "paid" ? "confirmed" : "payment_pending");
}
function orderTrackingMarkup(order) {
  const status = orderStatus(order);
  if (status === "pending_confirmation") return '<p class="account-track-current">Order request received</p><p class="account-note">Jija Studio will confirm product availability and payment details. Your request is saved in your account.</p>';
  if (status === "payment_pending") return '<p class="account-track-current">Payment confirmation pending</p><p class="account-note">Complete or confirm payment before fulfilment can begin. If you have paid, contact Jija Studio with your order number.</p>';
  if (status === "cancelled") return '<p class="account-track-current">This order is cancelled</p><p class="account-note">Contact Jija Studio if you need help with this order.</p>';
  const stages = [
    ["confirmed","Order confirmed"],["processing","Processing"],["packed","Packed"],["shipped","Shipped"],["delivered","Delivered"]
  ];
  const idx = stages.findIndex(x => x[0] === status);
  return '<p class="account-track-current">' + esc(statusLabels[status] || status) + '</p><ol class="account-order-items">' + stages.map((stage,i) => '<li>' + (idx >= i ? "✓ " : "○ ") + esc(stage[1]) + '</li>').join("") + '</ol>' +
    (order.statusUpdatedAt ? '<p class="account-order-meta">Last update: ' + esc(new Date(order.statusUpdatedAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})) + '</p>' : "");
}
function renderOrders(orders) {
  if (!orders.length) {
    $("customer-orders").innerHTML = '<div class="empty-state"><h3>Your Jija Studio orders will appear here.</h3><p>Once you place an order while signed in, you can return to this account to track progress.</p><a class="button button-primary" href="shop.html">Explore the shop</a></div>';
    return;
  }
  $("customer-orders").innerHTML = orders.map(order => {
    const status = orderStatus(order);
    const items = (order.items || []).map(item => '<li>' + esc(item.name) + ' (' + esc(item.size || "One Size") + (item.colour ? " · " + esc(item.colour) : "") + ') × ' + Number(item.quantity || 0) + ' — ' + money(item.lineTotal) + '</li>').join("");
    return '<article class="account-order">' +
      '<div class="account-order-top"><div><p class="eyebrow">YOUR JIJA STUDIO ORDER</p><h3>' + esc(order.orderNumber || "Order") + '</h3><p class="account-order-meta">' + (order.createdAt ? esc(new Date(order.createdAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})) : "Order date unavailable") + '</p></div><span class="account-order-badge">' + esc(statusLabels[status] || status) + '</span></div>' +
      '<ul class="account-order-items">' + items + '</ul>' +
      '<div class="account-order-top"><strong>Total: ' + money(order.total) + '</strong><button class="button button-outline" type="button" data-track-order="' + esc(order.id) + '">Track your order</button></div>' +
      '<div class="account-track-panel" data-track-panel="' + esc(order.id) + '"' + (expandedTrackOrders.has(String(order.id)) ? '' : ' hidden') + '>' + orderTrackingMarkup(order) + '</div></article>';
  }).join("");
  $("customer-orders").querySelectorAll("[data-track-order]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = $("customer-orders").querySelector('[data-track-panel="' + CSS.escape(button.dataset.trackOrder) + '"]');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      if (panel.hidden) expandedTrackOrders.delete(String(button.dataset.trackOrder));
      else expandedTrackOrders.add(String(button.dataset.trackOrder));
      button.textContent = panel.hidden ? "Track your order" : "Hide tracking";
    });
  });
}
async function loadOrders() {
  if (orderLoadInProgress || !auth.currentUser) return;
  orderLoadInProgress = true;
  try {
    $("orders-status").textContent = "Refreshing your orders…";
    const data = await accountApi().api("/api/customer/orders");
    renderOrders(data.orders || []);
    $("orders-status").textContent = (data.orders || []).length + " order(s) in your account. Last checked " + new Date().toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) + ".";
  } catch (error) {
    $("orders-status").textContent = error.message || "Your orders could not be loaded.";
  } finally {
    orderLoadInProgress = false;
  }
}
async function loadProfile(user) {
  if (!user) return;
  $("verified-phone").textContent = "Verified mobile number: " + (user.phoneNumber || "verified");
  try {
    const data = await accountApi().api("/api/customer/profile");
    const profile = data.profile;
    $("profile-name").value = profile?.name || user.displayName || "";
    $("profile-email").value = profile?.email || user.email || "";
    $("profile-address").value = profile?.address || "";
    $("profile-pin").value = profile?.pin || "";
    sayProfile(profile ? "Your profile is saved." : "Add your name to finish setting up your account.");
    await loadOrders();
    if (profile && returnTo === "cart.html" && !params.has("stay")) {
      $("profile-status").textContent = "Signed in. Taking you back to checkout…";
      setTimeout(() => location.replace("cart.html"), 650);
    }
  } catch (error) {
    sayProfile(error.message || "Your profile could not be loaded.");
  }
}
onAuthStateChanged(auth, user => {
  $("login-card").hidden = Boolean(user);
  $("account-panel").hidden = !user;
  if (orderRefreshTimer) { clearInterval(orderRefreshTimer); orderRefreshTimer = null; }
  if (!user) { loadedUid = ""; expandedTrackOrders.clear(); return; }
  orderRefreshTimer = setInterval(() => {
    if (!document.hidden && auth.currentUser?.uid === user.uid) void loadOrders();
  }, 30000);
  if (loadedUid === user.uid) return;
  loadedUid = user.uid;
  void loadProfile(user);
});

$("phone-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("send-otp");
  button.disabled = true;
  sayLogin("Preparing secure verification…");
  try {
    const phone = normalizeIndianPhone($("phone-input").value);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch {}
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" });
    await recaptchaVerifier.render();
    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    $("phone-input").value = phone;
    $("phone-form").hidden = true;
    $("otp-form").hidden = false;
    sayLogin("Verification code sent. Check your SMS messages.");
    $("otp-input").focus();
  } catch (error) {
    sayLogin(error.message || "Could not send the verification code. Please try again.");
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch {} recaptchaVerifier = null; }
  } finally { button.disabled = false; }
});
$("otp-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!confirmationResult) { sayLogin("Please request a new verification code."); return; }
  const button = $("verify-otp");
  button.disabled = true;
  sayLogin("Verifying your number…");
  try {
    const code = $("otp-input").value.trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit code from the SMS.");
    await confirmationResult.confirm(code);
    sayLogin("Mobile number verified. Your account is ready.");
  } catch (error) {
    sayLogin(error.message || "The code could not be verified. Please check it and retry.");
  } finally { button.disabled = false; }
});
$("change-number").addEventListener("click", () => {
  confirmationResult = null;
  $("otp-form").hidden = true;
  $("phone-form").hidden = false;
  $("otp-input").value = "";
  sayLogin("");
});
$("profile-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("save-profile");
  button.disabled = true;
  sayProfile("Saving your profile…");
  try {
    const name = $("profile-name").value.trim();
    const email = $("profile-email").value.trim();
    const address = $("profile-address").value.trim();
    const pin = $("profile-pin").value.trim();
    const data = await accountApi().api("/api/customer/profile", { method: "POST", body: { name, email, address, pin } });
    $("verified-phone").textContent = "Verified mobile number: " + (data.profile?.phone || auth.currentUser?.phoneNumber || "");
    sayProfile("Profile saved successfully.");
    if (returnTo === "cart.html") {
      $("profile-status").textContent = "Profile saved. Taking you back to checkout…";
      setTimeout(() => location.replace("cart.html"), 650);
    } else {
      await loadOrders();
    }
  } catch (error) { sayProfile(error.message || "Your profile could not be saved."); }
  finally { button.disabled = false; }
});
$("refresh-orders").addEventListener("click", loadOrders);
$("sign-out").addEventListener("click", async () => {
  try { await signOut(auth); sayLogin("You have signed out."); } catch (error) { sayLogin(error.message || "Could not sign out."); }
});
document.querySelectorAll("[data-year]").forEach(node => { node.textContent = new Date().getFullYear(); });
