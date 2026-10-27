// Jija Studio Firebase configuration
// Firebase web config is not a secret. Protect your data with Firebase Security Rules
// and enable Firebase Authentication before allowing admin writes.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCO6ZE-xPXDS65UXMhaqSQydc1Eius6wls",
  authDomain: "jija-7c104.firebaseapp.com",
  databaseURL: "https://jija-7c104-default-rtdb.firebaseio.com",
  projectId: "jija-7c104",
  storageBucket: "jija-7c104.firebasestorage.app",
  messagingSenderId: "164598307090",
  appId: "1:164598307090:web:a2401dc9562b99a972fbcb",
  measurementId: "G-EP51NCZLN7"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const database = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);
export const auth = getAuth(firebaseApp);

// Analytics may not be supported in every browser/context (for example, local file previews).
export const analyticsPromise = isSupported()
  .then(supported => supported ? getAnalytics(firebaseApp) : null)
  .catch(() => null);
