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
  status('Signed in. Loading products and settings from Firebase…');
  try {
    const [productsSnapshot, settingsSnapshot] = await Promise.all([
      get(ref(database, 'products')),
      get(ref(database, 'settings'))
    ]);
    const rawRemoteProducts = productsSnapshot.exists() ? productsSnapshot.val() : null;
    const remoteProducts = rawRemoteProducts === null ? null : (Array.isArray(rawRemoteProducts) ? rawRemoteProducts : Object.values(rawRemoteProducts || {})).filter(p => p && typeof p === 'object');
    const remoteSettings = settingsSnapshot.exists() ? settingsSnapshot.val() : null;

    // First connection: seed Firebase with this browser's current catalogue/settings.
    if (remoteProducts === null) {
      await set(ref(database, 'products'), (Array.isArray(localJson(PRODUCT_KEY, [])) ? localJson(PRODUCT_KEY, []) : Object.values(localJson(PRODUCT_KEY, {}) || {})).filter(p => p && typeof p === 'object'));
    } else {
      const remoteProductsJson = JSON.stringify(remoteProducts);
      if (localStorage.getItem(PRODUCT_KEY) !== remoteProductsJson) shouldReloadForRemoteData = true;
      try { localStorage.setItem(PRODUCT_KEY, remoteProductsJson); } catch (error) { console.warn('Firebase products loaded, but the browser cache is full. Continuing with Firebase as the source of truth.', error); }
      // Keep the remote catalogue intact; normalize its local representation without deleting products.
    }
    if (remoteSettings === null) {
      await set(ref(database, 'settings'), localJson(SETTINGS_KEY, {}));
    } else {
      const remoteSettingsJson = JSON.stringify(remoteSettings);
      if (localStorage.getItem(SETTINGS_KEY) !== remoteSettingsJson) shouldReloadForRemoteData = true;
      try { localStorage.setItem(SETTINGS_KEY, remoteSettingsJson); } catch (error) { console.warn('Firebase settings loaded, but the browser cache is full. Continuing with Firebase as the source of truth.', error); }
    }

    readyToSync = true;
    enableAutoSync();

    // The existing admin UI reads localStorage during startup. Reload once after
    // Firebase data is loaded so its product list and settings reflect the database.
    // The admin form initializes before Firebase loads. Reload if remote data changed local cache.
    if (shouldReloadForRemoteData) {
      location.reload();
      return;
    }
    document.body.classList.add('firebase-ready');
    status('Connected to Firebase · products and settings are shared');
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
