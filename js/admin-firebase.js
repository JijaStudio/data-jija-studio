import { auth, database } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  get,
  ref,
  set
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const loginStatus = document.getElementById('firebase-login-status');
const loginForm = document.getElementById('firebase-login-form');
const loginButton = document.getElementById('firebase-login-button');
const PRODUCT_KEY = 'jijaAdminProducts';
const SETTINGS_KEY = 'jijaAdminSettings';
let readyToSync = false;
let writeQueue = Promise.resolve();

function status(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#a32222' : '';
}

function localJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeFirebase(path, value) {
  // Serialize every write so a background localStorage sync cannot race an explicit save.
  const write = writeQueue.catch(() => {}).then(() => set(ref(database, path), value));
  writeQueue = write;
  await write;
}

async function syncLocalToFirebase(key, rawValue) {
  if (!readyToSync || !auth.currentUser) return;
  let value;
  try { value = JSON.parse(rawValue); } catch { return; }
  const path = key === PRODUCT_KEY ? 'products' : 'settings';
  // A blank local cache must never erase the shared catalogue automatically.
  if (path === 'products' && Array.isArray(value) && value.length === 0) {
    status('Safety stop: an empty product list was not synced to Firebase. Restore the catalogue before saving.', true);
    return;
  }
  try {
    await writeFirebase(path, value);
    status('Connected to Firebase · changes synced');
  } catch (error) {
    console.error('Firebase write failed:', error);
    status('Firebase write failed: ' + (error.code || error.message) + '. Check Realtime Database rules.', true);
  }
}

// Explicit save APIs use the same write queue as automatic sync and return only after Firebase confirms the write.
window.jijaSaveFirebaseSettings = async function(value) {
  if (!auth.currentUser || !readyToSync) throw new Error('Firebase is not connected. Please wait for the connected status and try again.');
  await writeFirebase('settings', value);
  return true;
};

window.jijaSaveFirebaseProducts = async function(value) {
  if (!auth.currentUser || !readyToSync) throw new Error('Firebase is not connected. Please wait for the connected status and try again.');
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Safety stop: refusing to replace the Firebase catalogue with an empty product list.');
  }
  await writeFirebase('products', value);
  status('Connected to Firebase · products synced');
  return true;
};

function enableAutoSync() {
  const originalSetItem = Storage.prototype.setItem;
  if (Storage.prototype.__jijaFirebasePatched) return;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && (key === PRODUCT_KEY || key === SETTINGS_KEY)) {
      void syncLocalToFirebase(key, String(value));
    }
  };
  Object.defineProperty(Storage.prototype, '__jijaFirebasePatched', { value: true });
}

async function connectAdmin(user) {
  let shouldReloadForRemoteData = false;
  let cacheWriteFailed = false;
  status('Signed in. Loading products and settings from Firebase…');
  try {
    const [productsSnapshot, settingsSnapshot] = await Promise.all([
      get(ref(database, 'products')),
      get(ref(database, 'settings'))
    ]);
    const rawRemoteProducts = productsSnapshot.exists() ? productsSnapshot.val() : null;
    const remoteProducts = rawRemoteProducts === null ? null : (Array.isArray(rawRemoteProducts) ? rawRemoteProducts : Object.values(rawRemoteProducts || {})).filter(p => p && typeof p === 'object');
    const remoteSettings = settingsSnapshot.exists() ? settingsSnapshot.val() : null;

    // Protect against an accidental empty catalogue write: if Firebase contains
    // no products but this admin browser still has a saved catalogue, recover it.
    // Never replace a non-empty remote catalogue with a local cache.
    const localRawProducts = localJson(PRODUCT_KEY, []);
    const localProducts = (Array.isArray(localRawProducts) ? localRawProducts : Object.values(localRawProducts || {}))
      .filter(p => p && typeof p === 'object');
    const localHasRecoverableProducts = localProducts.some(p => !p._deleted);
    if (remoteProducts === null && localHasRecoverableProducts) {
      // Seed Firebase only when a real saved local catalogue is available.
      await set(ref(database, 'products'), localProducts);
      try {
        const recoveredJson = JSON.stringify(localProducts);
        if (localStorage.getItem(PRODUCT_KEY) !== recoveredJson) shouldReloadForRemoteData = true;
        localStorage.setItem(PRODUCT_KEY, recoveredJson);
      } catch (error) {
        cacheWriteFailed = true;
        console.warn('Recovered products, but could not update the browser cache.', error);
      }
    } else if (remoteProducts !== null && remoteProducts.length === 0 && localHasRecoverableProducts) {
      // Recover an empty remote catalogue only from a non-empty local backup.
      status('Firebase catalogue is empty. Restoring saved products from this browser…');
      await set(ref(database, 'products'), localProducts);
      try {
        const recoveredJson = JSON.stringify(localProducts);
        if (localStorage.getItem(PRODUCT_KEY) !== recoveredJson) shouldReloadForRemoteData = true;
        localStorage.setItem(PRODUCT_KEY, recoveredJson);
      } catch (error) {
        cacheWriteFailed = true;
        console.warn('Recovered products, but could not update the browser cache.', error);
      }
    } else {
      const remoteProductsJson = JSON.stringify(remoteProducts || []);
      try {
        if (localStorage.getItem(PRODUCT_KEY) !== remoteProductsJson) shouldReloadForRemoteData = true;
        localStorage.setItem(PRODUCT_KEY, remoteProductsJson);
      } catch (error) {
        cacheWriteFailed = true;
        console.warn('Firebase products loaded, but the browser cache could not be updated.', error);
      }
    }
    if (remoteSettings === null) {
      await set(ref(database, 'settings'), localJson(SETTINGS_KEY, {}));
    } else {
      const remoteSettingsJson = JSON.stringify(remoteSettings);
      try {
        if (localStorage.getItem(SETTINGS_KEY) !== remoteSettingsJson) shouldReloadForRemoteData = true;
        localStorage.setItem(SETTINGS_KEY, remoteSettingsJson);
      } catch (error) {
        // Avoid a reload loop when the settings cache cannot be written.
        cacheWriteFailed = true;
        console.warn('Firebase settings loaded, but the browser cache is full. Continuing with Firebase as the source of truth.', error);
      }
    }

    readyToSync = true;
    enableAutoSync();

    // The existing admin UI reads localStorage during startup. Reload once after
    // Firebase data is loaded so its product list and settings reflect the database.
    // The admin form initializes before Firebase loads. Reload if remote data changed local cache.
    const reloadKey = 'jijaAdminHydrationReloaded';
    const alreadyReloaded = sessionStorage.getItem(reloadKey) === '1';
    if (shouldReloadForRemoteData && !cacheWriteFailed && !alreadyReloaded) {
      sessionStorage.setItem(reloadKey, '1');
      location.reload();
      return;
    }
    sessionStorage.removeItem(reloadKey);
    document.body.classList.add('firebase-ready');
    const visibleRemoteCount = Array.isArray(remoteProducts) ? remoteProducts.length : 0;
    if (visibleRemoteCount === 0 && !localHasRecoverableProducts) {
      status('Firebase connected, but 0 products were found. No empty catalogue was written. Restore a Firebase backup or recover an exported product backup before adding products.', true);
    } else {
      status('Connected to Firebase · ' + visibleRemoteCount + ' products loaded and shared');
    }
    let logout = document.getElementById('firebase-logout');
    if (!logout) {
      logout = document.createElement('button');
      logout.id = 'firebase-logout';
      logout.type = 'button';
      logout.className = 'button button-outline';
      logout.textContent = 'Sign out';
      logout.style.margin = '0 18px 18px';
      document.querySelector('.admin-shell')?.prepend(logout);
      logout.addEventListener('click', async () => {
        readyToSync = false;
        sessionStorage.removeItem('jijaFirebaseHydrated');
        await signOut(auth);
        location.reload();
      });
    }
  } catch (error) {
    console.error('Could not connect admin to Firebase:', error);
    document.body.classList.remove('firebase-ready');
    status('Firebase connection failed: ' + (error.code || error.message) + '. Confirm Realtime Database rules and Firebase Authentication.', true);
  }
}

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  loginButton.disabled = true;
  status('Signing in…');
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById('firebase-email').value.trim(),
      document.getElementById('firebase-password').value
    );
    // onAuthStateChanged will load data and reveal the admin.
  } catch (error) {
    console.error('Firebase sign-in failed:', error);
    status(error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
      ? 'Email or password is incorrect.'
      : 'Sign-in failed: ' + (error.code || error.message), true);
    loginButton.disabled = false;
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    void connectAdmin(user);
  } else {
    readyToSync = false;
    document.body.classList.remove('firebase-ready');
    loginButton.disabled = false;
    status('Please sign in with the Firebase admin email and password.');
  }
});
