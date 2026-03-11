/**
 * ═══════════════════════════════════════════════════════════
 * GROWBIT — Firestore Schema & Seed Data
 * Run this script once to initialise your Firestore database.
 * ═══════════════════════════════════════════════════════════
 *
 * Collections:
 *   users            — User profiles + points
 *   global_stats     — Public network metrics
 *   recruitments     — Recruitment events (used by Cloud Functions)
 *   points_history   — All point transactions per user
 *   monthly_history  — Aggregated monthly data per user
 *   products         — Product catalogue
 *   rewards          — Reward catalogue
 *   leaderboard      — (optional cache, auto-maintained)
 *
 * ═══════════════════════════════════════════════════════════
 */

// ── users/{uid} ──────────────────────────────────────────────
const USER_SCHEMA = {
  // Identity
  displayName:      "string — full name",
  email:            "string",
  customerId:       "string — GG20100 format (auto-generated)",
  role:             "string — 'user' | 'admin'",
  status:           "string — 'active' | 'suspended'",

  // Network
  recruitedBy:      "string | null — customerId of recruiter",

  // Points
  directPoints:     "number — points from own direct activity",
  firstOrbitPoints: "number — +2 per direct recruit's recruits",
  secondOrbitPoints:"number — +1 per 2nd-level recruits",
  totalPoints:      "number — directPoints + firstOrbitPoints + secondOrbitPoints",
  directRecruits:   "number — count of direct recruits",

  // Meta
  createdAt:        "Timestamp",
  updatedAt:        "Timestamp",
};

// ── global_stats/main ────────────────────────────────────────
const GLOBAL_STATS_INITIAL = {
  globalPool:          0,
  totalNetworkPoints:  0,
  teamSupportPoints:   0,
  newPartners:         0,
  lastReset:           null,
};

// ── global_stats/id_counter ──────────────────────────────────
const ID_COUNTER_INITIAL = {
  lastId: 20099,  // Next ID will be GG20100
};

// ── products/{docId} ─────────────────────────────────────────
const PRODUCT_SAMPLE = [
  { name: "Growbit Starter Pack", description: "Everything you need to begin your journey.", price: 1999, points: 50, emoji: "🚀", active: true },
  { name: "Premium Membership",   description: "Unlock exclusive network benefits.",          price: 4999, points: 150, emoji: "💎", active: true },
  { name: "Business Kit",         description: "Professional tools for network builders.",    price: 9999, points: 300, emoji: "💼", active: true },
];

// ── rewards/{docId} ──────────────────────────────────────────
const REWARD_SAMPLE = [
  { name: "Amazon Gift Card ₹500",  description: "Redeem for Amazon shopping.",    pointsRequired: 500,  emoji: "🛒" },
  { name: "Mobile Recharge ₹200",   description: "Any carrier mobile recharge.",   pointsRequired: 200,  emoji: "📱" },
  { name: "Growbit Merchandise",     description: "Exclusive branded merchandise.", pointsRequired: 1000, emoji: "👕" },
];

// ── recruitments/{docId} ─────────────────────────────────────
const RECRUITMENT_SCHEMA = {
  recruiterId:   "string — uid of recruiter",
  recruiterCid:  "string — customerId of recruiter",
  newUserId:     "string — uid of new user",
  newUserCid:    "string — customerId of new user",
  createdAt:     "Timestamp",
};

// ── points_history/{docId} ───────────────────────────────────
const POINTS_HISTORY_SCHEMA = {
  userId:      "string — uid",
  customerId:  "string — GG ID",
  points:      "number — positive or negative",
  description: "string",
  createdAt:   "Timestamp",
};

// ── monthly_history/{userId_YYYY-MM} ─────────────────────────
const MONTHLY_HISTORY_SCHEMA = {
  userId:       "string",
  customerId:   "string",
  month:        "string — YYYY-MM",
  pointsEarned: "number",
  recruits:     "number",
  updatedAt:    "Timestamp",
};

/*
 * ═══════════════════════════════════════════════════════════
 * SEED SCRIPT (run with: node seed.js)
 * Requires: npm install firebase-admin
 * Set GOOGLE_APPLICATION_CREDENTIALS to your service account
 * ═══════════════════════════════════════════════════════════
 */
const admin = require('firebase-admin');
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function seed() {
  const db = admin.firestore();

  // Global stats
  await db.collection('global_stats').doc('main').set(GLOBAL_STATS_INITIAL);
  await db.collection('global_stats').doc('id_counter').set(ID_COUNTER_INITIAL);
  console.log('✅ global_stats seeded');

  // Products
  for (const p of PRODUCT_SAMPLE) {
    await db.collection('products').add({ ...p, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  console.log('✅ products seeded');

  // Rewards
  for (const r of REWARD_SAMPLE) {
    await db.collection('rewards').add({ ...r, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }
  console.log('✅ rewards seeded');

  console.log('\n🎉 Seed complete! Your Growbit database is ready.');
}

// seed().catch(console.error);

module.exports = { GLOBAL_STATS_INITIAL, ID_COUNTER_INITIAL, USER_SCHEMA };
