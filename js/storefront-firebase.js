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
    let changed = false;
    if (productsSnapshot.exists()) {
      const raw = productsSnapshot.val();
      const list = Array.isArray(raw) ? raw : Object.values(raw || {});
      const clean = list.filter(p => p && !p._deleted && !isDemoProduct(p));
      const deleted = list.filter(p => p && p._deleted);
      localStorage.setItem(PRODUCT_KEY, JSON.stringify([...clean, ...deleted]));
      changed = true;
    }
    if (settingsSnapshot.exists()) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsSnapshot.val() || {}));
      changed = true;
    }
    if (changed) {
      window.dispatchEvent(new CustomEvent('jija:firebase-data-loaded'));
      if (sessionStorage.getItem(HYDRATED_KEY) !== 'yes') {
        sessionStorage.setItem(HYDRATED_KEY, 'yes');
        location.reload();
      }
    }
  } catch (error) {
    console.warn('Jija Studio shared catalogue/settings could not be loaded from Firebase.', error);
  }
}
void hydrateStorefront();
