// Jija Studio customer authentication uses Firebase Email/Password Auth (no SMS OTP).
import { auth, firebaseConfig } from "./firebase-config.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const PAYMENT_BACKEND = "https://jija-studio-payments.jijastudio-payments-test.workers.dev";
let resolveInitialAuth;
let initialStateSeen = false;
const ready = new Promise(resolve => { resolveInitialAuth = resolve; });

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

async function signIn(email, password) {
  const result = await signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
  return result.user;
}

async function createAccount({ name, email, phone, password }) {
  const result = await createUserWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
  if (name) await updateProfile(result.user, { displayName: String(name).trim() });
  // Store the registration details immediately, so customers do not need to re-enter them.
  await api("/api/customer/profile", {
    method: "POST",
    body: { name: String(name || "").trim(), email: String(email || "").trim(), phone: String(phone || "").trim(), address: "", pin: "" }
  });
  return result.user;
}

async function upgradePhoneAccount({ email, password, name, phone, address, pin }) {
  const user = auth.currentUser;
  if (!user || !user.phoneNumber || user.email) {
    throw new Error("This option is only for an existing signed-in mobile-only account.");
  }
  const normalizedEmail = String(email || "").trim();
  const normalizedName = String(name || user.displayName || "").trim();
  if (normalizedName.length < 2) throw new Error("Please complete your full name in your profile first.");
  if (!normalizedEmail) throw new Error("Enter the email address you want to use to sign in.");
  if (String(password || "").length < 6) throw new Error("Use a password with at least 6 characters.");
  const credential = EmailAuthProvider.credential(normalizedEmail, String(password));
  const linked = await linkWithCredential(user, credential);
  await api("/api/customer/profile", {
    method: "POST",
    body: {
      name: normalizedName,
      email: normalizedEmail,
      phone: String(phone || linked.user.phoneNumber || "").trim(),
      address: String(address || "").trim(),
      pin: String(pin || "").trim()
    }
  });
  return linked.user;
}

async function resetPassword(email) {
  const normalized = String(email || "").trim();
  if (!normalized) throw new Error("Enter the email address registered to your account first.");
  await sendPasswordResetEmail(auth, normalized);
}

async function signOut() {
  await firebaseSignOut(auth);
}

window.JijaCustomerAuth = {
  ready,
  auth,
  getUser: () => auth.currentUser,
  getHeaders,
  api,
  signIn,
  createAccount,
  upgradePhoneAccount,
  resetPassword,
  signOut,
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
  if (!user || !location.pathname.endsWith("cart.html")) return;
  try {
    const data = await api("/api/customer/profile");
    const profile = data.profile;
    const mappings = [
      ["customer-name", profile?.name || user.displayName || ""],
      ["customer-phone", profile?.phone || user.phoneNumber || ""],
      ["customer-address", profile?.address || ""],
      ["customer-pin", profile?.pin || ""]
    ];
    mappings.forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input && !input.value && value) input.value = value;
    });
    const note = document.getElementById("razorpay-test-note");
    if (note && !data.profile) note.textContent = "Finish your My Account profile before ordering.";
  } catch (error) {
    console.warn("Customer checkout profile could not be loaded.", error);
  }
}
window.addEventListener("jija-auth-change", event => { void fillCheckoutProfile(event.detail?.user); });
ready.then(user => fillCheckoutProfile(user));
