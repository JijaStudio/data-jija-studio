const $ = id => document.getElementById(id);
const accountApi = () => window.JijaCustomerAuth;
const auth = { get currentUser() { return accountApi()?.getUser() || null; } };
let pendingSignup = false;
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
    $("customer-orders").innerHTML = '<div class="empty-state"><h3>Your paid orders will appear here.</h3><p>An order is listed only after payment is successfully confirmed. Unpaid or abandoned checkout attempts will not appear in order tracking.</p><a class="button button-primary" href="shop.html">Explore the shop</a></div>';
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
    // Only successfully captured/verified payments count as placed orders.
    // Hide abandoned checkouts and failed/pending payment attempts from customer tracking.
    const paidOrders = (data.orders || []).filter(order => String(order.paymentStatus || "").toLowerCase() === "paid");
    renderOrders(paidOrders);
    $("orders-status").textContent = paidOrders.length + " paid order(s) in your account. Last checked " + new Date().toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) + ".";
  } catch (error) {
    $("orders-status").textContent = error.message || "Your orders could not be loaded.";
  } finally {
    orderLoadInProgress = false;
  }
}
async function loadProfile(user) {
  if (!user) return;
  $("verified-phone").textContent = "Signed in as " + (user.email || "your account") + (user.phoneNumber ? " · " + user.phoneNumber : "");
  try {
    const data = await accountApi().api("/api/customer/profile");
    const profile = data.profile;
    $("profile-name").value = profile?.name || user.displayName || "";
    $("profile-email").value = profile?.email || user.email || "";
    $("profile-phone").value = profile?.phone || user.phoneNumber || "";
    const addressUi = window.JijaIndiaAddress;
    if (addressUi) {
      await addressUi.restore("profile", profile?.address || "", profile?.pin || "");
    } else {
      $("profile-status").textContent = "Address selector is still loading. Reload the page and try again.";
    }
    sayProfile(profile ? "Your profile is saved. Verify the PIN before saving any address changes." : "Add your name and verified delivery address to finish setting up your account.");
    await loadOrders();
    if (profile && returnTo === "cart.html" && !params.has("stay")) {
      $("profile-status").textContent = "Signed in. Taking you back to checkout…";
      setTimeout(() => location.replace("cart.html"), 650);
    }
  } catch (error) {
    sayProfile(error.message || "Your profile could not be loaded.");
  }
}
function handleAuthChange(user) {
  $("login-card").hidden = Boolean(user);
  $("account-panel").hidden = !user;
  $("upgrade-account-card").hidden = !(user && user.phoneNumber && !user.email);
  if (orderRefreshTimer) { clearInterval(orderRefreshTimer); orderRefreshTimer = null; }
  if (!user) { loadedUid = ""; expandedTrackOrders.clear(); return; }
  orderRefreshTimer = setInterval(() => {
    if (!document.hidden && auth.currentUser?.uid === user.uid) void loadOrders();
  }, 30000);
  if (loadedUid === user.uid) return;
  loadedUid = user.uid;
  void loadProfile(user);
}
window.addEventListener("jija-auth-change", event => handleAuthChange(event.detail?.user || null));
accountApi().ready.then(user => handleAuthChange(user));

function setAuthMode(mode) {
  const signup = mode === "signup";
  $("auth-mode-signin").setAttribute("aria-pressed", String(!signup));
  $("auth-mode-signup").setAttribute("aria-pressed", String(signup));
  $("signin-form").hidden = signup;
  $("signup-form").hidden = !signup;
  $("login-card-title").textContent = signup ? "Create your Jija Studio account" : "Sign in to Jija Studio";
  sayLogin("");
}
$("auth-mode-signin").addEventListener("click", () => setAuthMode("signin"));
$("auth-mode-signup").addEventListener("click", () => setAuthMode("signup"));

$("signin-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("signin-button");
  button.disabled = true;
  sayLogin("Signing you in securely…");
  try {
    await accountApi().signIn($("signin-email").value, $("signin-password").value);
    sayLogin("Signed in successfully.");
  } catch (error) {
    const code = String(error.code || "");
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      sayLogin("Email or password is incorrect. Check your details or create an account.");
    } else {
      sayLogin(error.message || "Could not sign in. Please try again.");
    }
  } finally { button.disabled = false; }
});

$("signup-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("signup-button");
  button.disabled = true;
  sayLogin("Creating your account and saving your details…");
  try {
    const name = $("signup-name").value.trim();
    const email = $("signup-email").value.trim();
    const phone = normalizeIndianPhone($("signup-phone").value);
    const password = $("signup-password").value;
    const confirm = $("signup-password-confirm").value;
    const addressUi = window.JijaIndiaAddress;
    if (!addressUi || !addressUi.isVerified("signup")) throw new Error("Verify your delivery address and PIN code before creating the account.");
    const address = addressUi.getAddress("signup");
    const pin = addressUi.getPin("signup");
    if (name.length < 2) throw new Error("Enter your full name.");
    if (password.length < 6) throw new Error("Use a password with at least 6 characters.");
    if (password !== confirm) throw new Error("The passwords do not match.");
    const user = await accountApi().createAccount({ name, email, phone, password, address, pin });
    $("signup-password").value = "";
    $("signup-password-confirm").value = "";
    sayLogin("Account created. Your details have been saved.");
    await loadProfile(user);
  } catch (error) {
    const code = String(error.code || "");
    if (code.includes("email-already-in-use")) {
      sayLogin("An account already uses that email. Choose Sign in or use Forgot password.");
    } else if (code.includes("weak-password")) {
      sayLogin("Choose a stronger password with at least 6 characters.");
    } else {
      sayLogin(error.message || "Could not create your account. Please check your details.");
    }
  } finally {
    button.disabled = !(window.JijaIndiaAddress && window.JijaIndiaAddress.isVerified("signup"));
  }
});

$("forgot-password").addEventListener("click", async () => {
  const email = $("signin-email").value.trim();
  try {
    await accountApi().resetPassword(email);
    sayLogin("If this email is registered, a password-reset link has been sent. Check your inbox and spam folder. Need help? Call Jija Studio at +91 88309 03621.");
  } catch (error) {
    sayLogin((error.message || "Could not request a password reset.") + " For assistance, contact Jija Studio at +91 88309 03621.");
  }
});

$("profile-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("save-profile");
  button.disabled = true;
  sayProfile("Saving your profile…");
  try {
    const name = $("profile-name").value.trim();
    const email = $("profile-email").value.trim();
    const phone = normalizeIndianPhone($("profile-phone").value);
    const addressUi = window.JijaIndiaAddress;
    if (!addressUi || !addressUi.isVerified("profile")) throw new Error("Verify the delivery PIN code and location before saving your profile.");
    const address = addressUi.getAddress("profile");
    const pin = addressUi.getPin("profile");
    const data = await accountApi().api("/api/customer/profile", { method: "POST", body: { name, email, phone, address, pin, addressVerified: true } });
    $("verified-phone").textContent = "Signed in as " + (auth.currentUser?.email || "") + " · " + (data.profile?.phone || auth.currentUser?.phoneNumber || phone);
    sayProfile("Profile saved successfully.");
    if (returnTo === "cart.html") {
      $("profile-status").textContent = "Profile saved. Taking you back to checkout…";
      setTimeout(() => location.replace("cart.html"), 650);
    } else {
      await loadOrders();
    }
  } catch (error) { sayProfile(error.message || "Your profile could not be saved."); }
  finally { button.disabled = !(window.JijaIndiaAddress && window.JijaIndiaAddress.isVerified("profile")); }
});
$("refresh-orders").addEventListener("click", loadOrders);
$("upgrade-account-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("upgrade-account-button");
  button.disabled = true;
  $("upgrade-account-status").textContent = "Linking your email and password to this existing account…";
  try {
    const password = $("upgrade-password").value;
    const confirm = $("upgrade-password-confirm").value;
    if (password !== confirm) throw new Error("The passwords do not match.");
    const addressUi = window.JijaIndiaAddress;
    if (!addressUi || !addressUi.isVerified("profile")) throw new Error("Verify your delivery address and PIN code before linking email and password.");
    const user = await accountApi().upgradePhoneAccount({
      email: $("upgrade-email").value.trim(),
      password,
      name: $("profile-name").value.trim(),
      phone: $("profile-phone").value.trim() || auth.currentUser?.phoneNumber || "",
      address: addressUi.getAddress("profile"),
      pin: addressUi.getPin("profile")
    });
    $("upgrade-password").value = "";
    $("upgrade-password-confirm").value = "";
    $("upgrade-account-card").hidden = true;
    $("verified-phone").textContent = "Signed in as " + (user.email || "") + " · " + (user.phoneNumber || "");
    $("upgrade-account-status").textContent = "Your existing account now supports email and password sign-in. Your account ID and existing order links are preserved.";
    sayProfile("Existing account updated. You can now sign in with email and password.");
    await loadProfile(user);
  } catch (error) {
    const code = String(error.code || "");
    if (code.includes("email-already-in-use") || code.includes("credential-already-in-use")) {
      $("upgrade-account-status").textContent = "That email already belongs to another account. Try a different email or contact Jija Studio at +91 88309 03621.";
    } else {
      $("upgrade-account-status").textContent = error.message || "Could not update your existing account. Please try again.";
    }
  } finally { button.disabled = false; }
});

$("sign-out").addEventListener("click", async () => {
  try { await accountApi().signOut(); sayLogin("You have signed out."); } catch (error) { sayLogin(error.message || "Could not sign out."); }
});
document.querySelectorAll("[data-year]").forEach(node => { node.textContent = new Date().getFullYear(); });
