import { database } from './firebase-config.js';
import { onValue, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

function normalizeList(raw) {
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  return list.filter(p => p && typeof p === 'object');
}

let gotProducts = false;
let gotSettings = false;

// Product data must not wait for the settings read: if settings are blocked or
// temporarily unavailable, the catalogue should still load from Firebase.
function notifyStorefront() {
  if (!gotProducts) return;
  if (!window.jijaFirebaseSettings || typeof window.jijaFirebaseSettings !== 'object') {
    window.jijaFirebaseSettings = {};
  }
  window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded', {
    detail: { productsLoaded: gotProducts, settingsLoaded: gotSettings }
  }));
}

onValue(ref(database, 'products'), snapshot => {
  window.jijaFirebaseProducts = snapshot.exists() ? normalizeList(snapshot.val()) : [];
  gotProducts = true;
  notifyStorefront();
}, error => {
  console.warn('Jija Studio could not read products from Firebase.', error);
});

onValue(ref(database, 'settings'), snapshot => {
  window.jijaFirebaseSettings = snapshot.exists() ? (snapshot.val() || {}) : {};
  gotSettings = true;
  notifyStorefront();
}, error => {
  console.warn('Jija Studio could not read settings from Firebase.', error);
});
