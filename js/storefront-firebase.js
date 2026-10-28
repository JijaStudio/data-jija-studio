import { database } from './firebase-config.js';
import { get, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

function normalizeList(raw) {
  const list = Array.isArray(raw) ? raw : Object.values(raw || {});
  return list.filter(p => p && typeof p === 'object');
}

async function hydrateStorefront() {
  try {
    const [productsSnapshot, settingsSnapshot] = await Promise.all([
      get(ref(database, 'products')),
      get(ref(database, 'settings'))
    ]);
    if (productsSnapshot.exists()) {
      window.jijaFirebaseProducts = normalizeList(productsSnapshot.val());
    }
    if (settingsSnapshot.exists()) {
      window.jijaFirebaseSettings = settingsSnapshot.val() || {};
    }
    // Do not copy the full catalogue into localStorage: product images may exceed
    // the browser's quota. Keep Firebase data in memory and re-render the page.
    window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded'));
  } catch (error) {
    console.warn('Jija Studio shared catalogue/settings could not be loaded from Firebase. Showing cached/demo products instead.', error);
  }
}
void hydrateStorefront();
