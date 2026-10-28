import { database } from './firebase-config.js';
import { onValue, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

function normalizeList(raw) {
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  return list.filter(p => p && typeof p === 'object');
}

let gotProducts = false;
let gotSettings = false;

function notifyStorefront() {
  // Wait until both Firebase reads have returned before rendering, so the
  // catalogue and store settings are applied together on first load.
  if (!gotProducts || !gotSettings) return;
  window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded'));
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
