import { database } from './firebase-config.js';
import { get, ref } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const PRODUCT_KEY = 'jijaAdminProducts';
const SETTINGS_KEY = 'jijaAdminSettings';
const HYDRATED_KEY = 'jijaStorefrontFirebaseHydrated';

function isDemoProduct(p) {
  return !p || p.placeholder === true || String(p.id) === '121' ||
    /demo|sample product|dusty rose floral embroidered kurta set with dupatta/i.test(String(p.name || ''));
}

async function hydrateStorefront() {
  try {
    const [productsSnapshot, settingsSnapshot] = await Promise.all([
      get(ref(database, 'products')),
      get(ref(database, 'settings'))
    ]);
    let dataChanged = false;
    if (productsSnapshot.exists()) {
      const raw = productsSnapshot.val();
      const list = Array.isArray(raw) ? raw : Object.values(raw || {});
      const clean = list.filter(p => p && !p._deleted && !isDemoProduct(p));
      const deleted = list.filter(p => p && p._deleted);
      const nextProducts = JSON.stringify([...clean, ...deleted]);
      if (localStorage.getItem(PRODUCT_KEY) !== nextProducts) {
        localStorage.setItem(PRODUCT_KEY, nextProducts);
        dataChanged = true;
      }
    }
    if (settingsSnapshot.exists()) {
      const nextSettings = JSON.stringify(settingsSnapshot.val() || {});
      if (localStorage.getItem(SETTINGS_KEY) !== nextSettings) {
        localStorage.setItem(SETTINGS_KEY, nextSettings);
        dataChanged = true;
      }
    }
    if (dataChanged) {
      // main.js reads localStorage during DOMContentLoaded. Reload only when the
      // Firebase values actually differ, so new products render even in a tab
      // that has already hydrated once, without creating a reload loop.
      window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded'));
      sessionStorage.setItem(HYDRATED_KEY, 'yes');
      location.reload();
    }
  } catch (error) {
    console.warn('Jija Studio shared catalogue/settings could not be loaded from Firebase.', error);
  }
}
void hydrateStorefront();
