// Customer sign-in for Jija Studio: OTP verification runs through the Cloudflare Worker and MSG91.
const PAYMENT_BACKEND = "https://jija-studio-payments.jijastudio-payments-test.workers.dev";
const SESSION_KEY = "jija_customer_session_v1";
function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!value || !value.token || !value.user?.uid || !value.user?.phoneNumber || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}
let session = readSession();
const auth = { get currentUser() { return session?.user || null; } };
const ready = Promise.resolve(auth.currentUser);
function announceAuthChange() {
  window.dispatchEvent(new CustomEvent("jija-auth-change", { detail: { user: auth.currentUser } }));
}
async function requestJson(path, body, authenticated = false) {
  const headers = { "Accept": "application/json", "Content-Type": "application/json" };
  if (authenticated) {
    if (!session || session.expiresAt <= Date.now()) throw new Error("Please sign in to your Jija Studio account first.");
    headers.Authorization = "Bearer " + session.token;
  }
  const response = await fetch(PAYMENT_BACKEND + path, { method: "POST", headers, body: JSON.stringify(body || {}), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The account service could not complete this request.");
  return data;
}
async function getHeaders() {
  if (!session || session.expiresAt <= Date.now()) throw new Error("Your sign-in has expired. Please verify your mobile number again.");
  return { "Authorization": "Bearer " + session.token };
}
async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { "Accept": "application/json", ...(await getHeaders()) };
  const request = { method, headers, cache: "no-store" };
  if (options.body !== undefined) { headers["Content-Type"] = "application/json"; request.body = JSON.stringify(options.body); }
  const response = await fetch(PAYMENT_BACKEND + path, request);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The account service could not complete this request.");
  return data;
}
async function sendOtp(phone) { return requestJson("/api/auth/send-otp", { phone }); }
async function verifyOtp(phone, otp) {
  const data = await requestJson("/api/auth/verify-otp", { phone, otp });
  if (!data.authenticated || !data.token || !data.user?.uid || !data.user?.phoneNumber || !data.expiresAt) throw new Error("The verification service returned an incomplete sign-in response.");
  session = { token: data.token, expiresAt: Number(data.expiresAt), user: data.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  announceAuthChange();
  return session.user;
}
async function signOut() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  announceAuthChange();
}
window.JijaCustomerAuth = { ready, auth, getUser: () => auth.currentUser, getHeaders, api, sendOtp, verifyOtp, signOut, backend: PAYMENT_BACKEND };
queueMicrotask(announceAuthChange);

async function fillCheckoutProfile(user) {
  if (!user || !location.pathname.endsWith("cart.html")) return;
  try {
    const data = await api("/api/customer/profile");
    const profile = data.profile;
    const mappings = [
      ["customer-name", profile?.name || ""], ["customer-phone", user.phoneNumber || profile?.phone || ""],
      ["customer-address", profile?.address || ""], ["customer-pin", profile?.pin || ""]
    ];
    mappings.forEach(([id, value]) => { const input = document.getElementById(id); if (input && !input.value && value) input.value = value; });
    const note = document.getElementById("razorpay-test-note");
    if (note && !data.profile) note.textContent = "Finish your My Account profile before ordering. Your mobile number has been verified.";
  } catch (error) { console.warn("Customer checkout profile could not be loaded.", error); }
}
window.addEventListener("jija-auth-change", event => { void fillCheckoutProfile(event.detail?.user); });
ready.then(user => fillCheckoutProfile(user));
