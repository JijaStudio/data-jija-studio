# Jija Studio Razorpay + WhatsApp setup

The files in GitHub are source code only. **A GitHub commit does not deploy Firebase Functions.** The endpoints will remain missing until you deploy them to Firebase project `jija-7c104`.

## 1. Requirements

- Node.js 20 and npm.
- Firebase CLI: `npm install -g firebase-tools`.
- Access to Firebase project `jija-7c104`.
- Firebase project on the **Blaze (pay-as-you-go) plan**; Cloud Functions deployment generally requires billing to be enabled.
- Razorpay Test Mode Key ID and Key Secret.
- A webhook secret for Razorpay.
- Meta WhatsApp Cloud API credentials and approved templates, if automatic WhatsApp notifications are required.

The repository now includes `.firebaserc` so Firebase CLI uses `jija-7c104` by default. You can still explicitly pass `--project jija-7c104`.

## 2. Install and configure secrets

From the repository root:

```bash
firebase login
firebase projects:list
firebase use jija-7c104
cd functions
npm install
cd ..
```

Set each secret when prompted; do not paste secret values into source files or commit them:

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID --project jija-7c104
firebase functions:secrets:set RAZORPAY_KEY_SECRET --project jija-7c104
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET --project jija-7c104
firebase functions:secrets:set WHATSAPP_TOKEN --project jija-7c104
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID --project jija-7c104
firebase functions:secrets:set WHATSAPP_STORE_NUMBER --project jija-7c104
firebase functions:secrets:set WHATSAPP_ORDER_TEMPLATE --project jija-7c104
firebase functions:secrets:set WHATSAPP_CUSTOMER_TEMPLATE --project jija-7c104
```

If you are not ready to configure WhatsApp, enter placeholder values for the four WhatsApp identifiers/templates and token only if Firebase requires all declared secrets to exist; do not expect notifications to work until real credentials and approved templates are configured. Do not use a real customer's number for test messages.

## 3. Deploy and confirm endpoints

From the repository root:

```bash
firebase deploy --project jija-7c104 --only functions
firebase functions:list --project jija-7c104
```

Wait for deployment to finish successfully. In Firebase Console, select project `jija-7c104` → **Build → Functions** and confirm these functions appear in region `asia-south1`:

- `createRazorpayOrder`
- `verifyRazorpayPayment`
- `getOrderStatus`
- `razorpayWebhook`

If deployment fails, copy the **first error and the surrounding lines** from the terminal. Common blockers are billing not enabled, insufficient IAM permissions, an unsupported Node runtime, or a secret that has not been created. A source file appearing in GitHub does not mean the function is deployed.

## 4. Razorpay webhook

In Razorpay Dashboard **Test Mode**, configure the webhook URL shown for `razorpayWebhook` after deployment, use the same value configured as `RAZORPAY_WEBHOOK_SECRET`, and subscribe to `payment.captured`. Keep Test Mode enabled until checkout, payment failure, webhook retry, and verification have been tested.

## 5. WhatsApp templates

Configure the exact approved template names in `WHATSAPP_ORDER_TEMPLATE` and `WHATSAPP_CUSTOMER_TEMPLATE`. Both templates are expected to accept three body parameters: order number, customer name, and total amount. Ensure customers have opted in.

## 6. Security and testing

- Configure Firebase Realtime Database rules so public clients cannot read/write `orders`; only authenticated admins should be able to read orders and update fulfilment status. The Admin SDK writes order records server-side.
- The backend recalculates product prices and shipping from Firebase; it does not trust client totals.
- Stock is checked but not atomically reserved/decremented, so inventory handling should be improved before high-volume launch.
- Only show a success confirmation after server-side payment verification. Do not treat a browser redirect alone as proof of payment.
- Rotate any Razorpay secret that was previously pasted into a chat or committed to source, and save the replacement only with Firebase Functions secrets.
