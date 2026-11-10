// Shared customer authentication and secure customer API helper for Jija Studio.
import { auth, firebaseConfig } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const PAYMENT_BACKEND = "https://jija-studio-payments.jijastudio-payments-test.workers.dev";
let resolveInitialAuth;
const ready = new Promise(resolve => { resolveInitialAuth = resolve; });
let initialStateSeen = false;

async function getHeaders() {
  await ready;
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to your Jija Studio account first.");
  const token = await user.getIdToken();
  return {
    "Authorization": "Bearer " + token,
    "X-Firebase-Api-Key": firebaseConfig.apiKey
  };
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { "Accept": "application/json", ...(await getHeaders()) };
  const request = { method, headers, cache: "no-store" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }
  const response = await fetch(PAYMENT_BACKEND + path, request);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The account service could not complete this request.");
  return data;
}

window.JijaCustomerAuth = {
  ready,
  auth,
  getUser: () => auth.currentUser,
  getHeaders,
  api,
  backend: PAYMENT_BACKEND
};

onAuthStateChanged(auth, user => {
  if (!initialStateSeen) {
    initialStateSeen = true;
    resolveInitialAuth(user);
  }
  window.dispatchEvent(new CustomEvent("jija-auth-change", { detail: { user: user || null } }));
});

async function fillCheckoutProfile(user) {
  if (!user || !location.pathname.endsWith("/cart.html") && !location.pathname.endsWith("cart.html")) return;
  try {
    const data = await api("/api/customer/profile");
    const profile = data.profile;
    const mappings = [
      ["customer-name", profile?.name || user.displayName || ""],
      ["customer-phone", user.phoneNumber || profile?.phone || ""],
      ["customer-address", profile?.address || ""],
      ["customer-pin", profile?.pin || ""]
    ];
    mappings.forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input && !input.value && value) input.value = value;
    });
    const note = document.getElementById("razorpay-test-note");
    if (note && !data.profile) note.textContent = "Finish your My Account profile before ordering. Your mobile number has been verified.";
  } catch (error) {
    console.warn("Customer checkout profile could not be loaded.", error);
  }
}
window.addEventListener("jija-auth-change", event => { void fillCheckoutProfile(event.detail?.user); });
ready.then(user => fillCheckoutProfile(user));
