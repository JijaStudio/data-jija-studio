# Jija Studio Razorpay + WhatsApp setup

This is backend source code. It is NOT live until deployed and configured. Keep Razorpay in Test Mode until all tests pass.

## Requirements
- Firebase CLI and access to project jija-7c104.
- Firebase project plan supporting Cloud Functions.
- Razorpay Key ID and Key Secret; use Test Mode first.
- Meta WhatsApp Business Platform Cloud API phone-number ID, access token, store WhatsApp number and approved utility templates.
- Both WhatsApp templates must accept three body parameters: order number, customer name, total amount. Customers must opt in; template names and language must match Meta configuration.

## Deploy
1. From repository root: `firebase use jija-7c104`.
2. Run `firebase functions:secrets:set RAZORPAY_KEY_ID`, then enter the key ID when prompted.
3. Repeat for `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_STORE_NUMBER`, `WHATSAPP_ORDER_TEMPLATE`, and `WHATSAPP_CUSTOMER_TEMPLATE`.
4. Run `cd functions && npm install && cd ..`, then `firebase deploy --only functions`.
5. In Razorpay Dashboard (Test Mode), add the deployed `razorpayWebhook` URL as a webhook, set the same webhook secret, and subscribe to `payment.captured`.
6. Set the deployed function URLs in `js/razorpay-checkout.js`.
7. Configure Firebase Realtime Database rules so public clients cannot read/write `orders`; only authenticated admin users may read orders/update fulfilment status. Admin SDK functions write order records server-side. Never use open rules.
8. Run a test payment, failed/cancelled payment, webhook retry, and both WhatsApp notifications. Only switch to Live Mode after these pass.

## Important
- The backend recalculates product prices and shipping from Firebase; it does not trust client totals.
- It checks current stock but does not reserve/decrement stock atomically; inventory reservation should be added before a high-volume launch.
- Notification sends use approved WhatsApp templates. Configure the exact approved template names and customer opt-in.
- A customer-facing confirmation is displayed only after server verification; the confirmation page is not itself proof of payment.
