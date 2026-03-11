// ============================================================
// GROWBIT — Firebase Configuration
// Replace these values with your actual Firebase project config
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (imported via compat CDN in each HTML page)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// ── Firestore persistence (offline support) ──────────────────
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
