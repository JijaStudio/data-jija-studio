import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { get, ref, update } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const $ = id => document.getElementById(id);
const status = $('payment-settings-status');
const saveButton = $('save-payment-settings');

function show(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#a32222' : '';
}

async function loadSettings() {
  const snapshot = await get(ref(database, 'settings'));
  const settings = snapshot.exists() ? (snapshot.val() || {}) : {};
  const payment = settings.paymentSettings || {};
  
  $('pay-upi-id').value = settings.upiId || payment.upiId || '';
  $('pay-upi-name').value = settings.upiName || payment.upiName || 'Jija Studio';
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    if (saveButton) saveButton.disabled = true;
    show('Sign in to the Firebase admin panel to load and save payment settings.', true);
    return;
  }
  try {
    await loadSettings();
    if (saveButton) saveButton.disabled = false;
    show('Payment settings loaded from Firebase.');
  } catch (error) {
    show('Could not load payment settings: ' + (error.code || error.message), true);
  }
});

saveButton?.addEventListener('click', async () => {
  if (!auth.currentUser) return show('Please sign in again before saving.', true);
  const upiId = $('pay-upi-id').value.trim();
  const upiName = $('pay-upi-name').value.trim() || 'Jija Studio';
  saveButton.disabled = true;
  show('Saving payment settings to Firebase…');
  try {
    const paymentSettings = {
      razorpayEnabled: false,
      upiEnabled: false,
      upiId,
      upiName,
      updatedAt: Date.now(),
      updatedBy: auth.currentUser.uid
    };
    // Update only payment-related keys, preserving homepage, shipping, coupon and collection settings.
    await update(ref(database, 'settings'), {
      paymentSettings,
      upiId,
      upiName
    });
    localStorage.setItem('jijaAdminSettings', JSON.stringify({
      ...JSON.parse(localStorage.getItem('jijaAdminSettings') || '{}'),
      paymentSettings, upiId, upiName
    }));
    window.dispatchEvent(new CustomEvent('jija:payment-settings-saved', { detail: paymentSettings }));
    window.jijaFirebaseSettings = { ...(window.jijaFirebaseSettings || {}), upiId, upiName, paymentSettings };
    window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded', { detail: { settingsLoaded: true, productsLoaded: true } }));
    show('Saved successfully. Razorpay is disabled; orders are handled through WhatsApp. Refresh the storefront to load updated contact/payment settings.');
  } catch (error) {
    show('Save failed: ' + (error.code || error.message) + '. Check Firebase Realtime Database rules.', true);
  } finally {
    saveButton.disabled = false;
  }
});
