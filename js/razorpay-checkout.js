/* Razorpay checkout bridge for the existing Jija Studio cart. */
(() => {
  const BASE = "https://asia-south1-jija-7c104.cloudfunctions.net";
  const CREATE_URL = BASE + "/createRazorpayOrder";
  const VERIFY_URL = BASE + "/verifyRazorpayPayment";
  const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
  const $ = id => document.getElementById(id);
  function show(message) {
    const node = $("checkout-message");
    if (node) { node.hidden = false; node.textContent = message; }
  }
  function loadRazorpay() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load secure checkout. Please try again."));
      document.head.appendChild(script);
    });
  }
  async function post(url, body) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Checkout request failed.");
    return data;
  }
  document.addEventListener("DOMContentLoaded", () => {
    const form = $("checkout-form");
    if (!form) return;
    // Capture before the legacy WhatsApp-order handler, replacing it with secure checkout.
    form.addEventListener("submit", async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const cart = JSON.parse(localStorage.getItem("jijaCart") || "[]");
      if (!cart.length) { show("Your bag is empty."); return; }
      if (!form.reportValidity()) return;
      const customer = {
        name: $("customer-name").value.trim(),
        phone: $("customer-phone").value.trim(),
        address: $("customer-address").value.trim(),
        pin: $("customer-pin").value.trim()
      };
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = "Preparing secure payment…";
      try {
        await loadRazorpay();
        const items = cart.map(item => ({ id: String(item.id), quantity: Number(item.quantity), size: item.size || "One Size", colour: item.colour || "" }));
        const order = await post(CREATE_URL, { customer, items });
        const checkout = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Jija Studio",
          description: "Order " + order.orderNumber,
          order_id: order.razorpayOrderId,
          prefill: { name: order.customer.name, contact: order.customer.phone },
          notes: { orderNumber: order.orderNumber },
          theme: { color: "#174d38" },
          modal: { ondismiss: () => { button.disabled = false; button.textContent = "Pay securely with Razorpay"; show("Payment was not completed. Your order is not confirmed; you can try again."); } },
          handler: async function (response) {
            button.disabled = true;
            button.textContent = "Verifying payment…";
            try {
              const verified = await post(VERIFY_URL, { orderId: order.orderId, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature });
              if (verified.paymentStatus !== "paid") throw new Error("Payment could not be confirmed yet.");
              sessionStorage.setItem("jijaLastPaidOrder", JSON.stringify({ orderId: verified.orderId, orderNumber: verified.orderNumber, total: order.amount / 100, items: order.orderNumber }));
              localStorage.setItem("jijaCart", "[]");
              window.location.href = "order-confirmation.html?order=" + encodeURIComponent(verified.orderId);
            } catch (error) {
              show("We received the payment response but could not verify it yet. Please do not pay again. Contact Jija Studio with order " + order.orderNumber + ". " + error.message);
              button.disabled = false;
              button.textContent = "Retry payment verification";
            }
          }
        });
        checkout.on("payment.failed", response => {
          show("Payment failed or was cancelled. No order confirmation has been issued. " + (response.error?.description || ""));
          button.disabled = false;
          button.textContent = "Pay securely with Razorpay";
        });
        button.textContent = "Complete payment in Razorpay";
        checkout.open();
      } catch (error) {
        show(error.message + " If checkout has not been deployed yet, ask the store administrator to finish the setup.");
        button.disabled = false;
        button.textContent = "Pay securely with Razorpay";
      }
    }, true);
    form.querySelector('[type="submit"]').textContent = "Pay securely with Razorpay";
    const paymentBox = document.querySelector(".payment-box");
    if (paymentBox) paymentBox.hidden = true;
  });
})();
