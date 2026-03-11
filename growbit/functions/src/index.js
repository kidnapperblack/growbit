/**
 * GROWBIT — Firebase Cloud Functions
 * 
 * Functions:
 *   1. createUser          — Creates a new user with auto-generated GG ID
 *   2. onUserCreated       — Triggers point distribution on new recruitment
 *   3. onRecruitmentAdded  — Secondary point update via recruitments collection
 *   4. monthlyReset        — Scheduled monthly reset (Cloud Scheduler)
 *   5. updateLeaderboard   — Recalculates global stats after point changes
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ══════════════════════════════════════════════════════════════
// HELPER: Generate next GG ID  (GG20100, GG20101, ...)
// Uses a Firestore transaction on global_stats/id_counter
// ══════════════════════════════════════════════════════════════
async function generateCustomerId() {
  const counterRef = db.collection('global_stats').doc('id_counter');
  return db.runTransaction(async tx => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data().lastId || 20099) : 20099;
    const next = current + 1;
    tx.set(counterRef, { lastId: next }, { merge: true });
    return 'GG' + next;
  });
}

// ══════════════════════════════════════════════════════════════
// 1. createUser — HTTPS callable from Admin Panel
// Body: { name, email, password, recruitedBy? }
// ══════════════════════════════════════════════════════════════
exports.createUser = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { name, email, password, recruitedBy } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, password are required' });
  }

  try {
    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      displayName: name,
      email,
      password,
    });

    // Generate Customer ID
    const customerId = await generateCustomerId();

    // Resolve recruitedBy customerId → uid if provided
    let recruiterUid = null;
    if (recruitedBy) {
      const rSnap = await db.collection('users')
        .where('customerId', '==', recruitedBy)
        .limit(1).get();
      if (!rSnap.empty) recruiterUid = rSnap.docs[0].id;
    }

    // Create Firestore user document
    const userData = {
      displayName: name,
      email,
      customerId,
      role: 'user',
      status: 'active',
      directPoints:      0,
      firstOrbitPoints:  0,
      secondOrbitPoints: 0,
      totalPoints:       0,
      directRecruits:    0,
      recruitedBy:       recruitedBy || null,
      createdAt:         admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(userRecord.uid).set(userData);

    // Record recruitment relationship & trigger point distribution
    if (recruiterUid) {
      await db.collection('recruitments').add({
        recruiterId:    recruiterUid,
        recruiterCid:   recruitedBy,
        newUserId:      userRecord.uid,
        newUserCid:     customerId,
        createdAt:      admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Increment global new partners
    await db.collection('global_stats').doc('main').set(
      { newPartners: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );

    res.status(200).json({ success: true, customerId, uid: userRecord.uid });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════════
// 2. onRecruitmentAdded — Trigger when new recruitment doc created
//    Distributes: +2 to direct recruiter, +1 to recruiter's recruiter
// ══════════════════════════════════════════════════════════════
exports.onRecruitmentAdded = functions.firestore
  .document('recruitments/{docId}')
  .onCreate(async (snap) => {
    const { recruiterId, recruiterCid, newUserId, newUserCid } = snap.data();
    const batch = db.batch();

    // Level 1: +2 pts to the direct recruiter
    const recruiterRef = db.collection('users').doc(recruiterId);
    const recruiterSnap = await recruiterRef.get();
    if (recruiterSnap.exists) {
      batch.update(recruiterRef, {
        directPoints:     admin.firestore.FieldValue.increment(2),
        firstOrbitPoints: admin.firestore.FieldValue.increment(2),
        totalPoints:      admin.firestore.FieldValue.increment(2),
        directRecruits:   admin.firestore.FieldValue.increment(1),
      });

      // Record history for recruiter
      const histRef = db.collection('points_history').doc();
      batch.set(histRef, {
        userId:      recruiterId,
        customerId:  recruiterCid,
        points:      2,
        description: `Direct recruit bonus — ${newUserCid} joined`,
        createdAt:   admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update global stats
      batch.set(
        db.collection('global_stats').doc('main'),
        {
          totalNetworkPoints:  admin.firestore.FieldValue.increment(2),
          teamSupportPoints:   admin.firestore.FieldValue.increment(2),
          globalPool:          admin.firestore.FieldValue.increment(2),
        },
        { merge: true }
      );
    }

    // Level 2: +1 pt to the recruiter's recruiter (grandparent)
    if (recruiterSnap.exists) {
      const grandparentCid = recruiterSnap.data().recruitedBy;
      if (grandparentCid) {
        const gpSnap = await db.collection('users')
          .where('customerId', '==', grandparentCid)
          .limit(1).get();
        if (!gpSnap.empty) {
          const gpRef = gpSnap.docs[0].ref;
          batch.update(gpRef, {
            secondOrbitPoints: admin.firestore.FieldValue.increment(1),
            totalPoints:       admin.firestore.FieldValue.increment(1),
          });

          const histRef2 = db.collection('points_history').doc();
          batch.set(histRef2, {
            userId:     gpSnap.docs[0].id,
            customerId: grandparentCid,
            points:     1,
            description: `2nd orbit bonus — ${newUserCid} joined via ${recruiterCid}`,
            createdAt:  admin.firestore.FieldValue.serverTimestamp(),
          });

          batch.set(
            db.collection('global_stats').doc('main'),
            {
              totalNetworkPoints: admin.firestore.FieldValue.increment(1),
              globalPool:         admin.firestore.FieldValue.increment(1),
            },
            { merge: true }
          );
        }
      }
    }

    await batch.commit();
    console.log(`Points distributed for recruitment: ${newUserCid}`);
  });


// ══════════════════════════════════════════════════════════════
// 3. updateMonthlyHistory — triggered on user totalPoints update
//    Logs monthly history per user
// ══════════════════════════════════════════════════════════════
exports.updateMonthlyHistory = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data();
    const userId = context.params.userId;

    const ptsChange = (after.totalPoints || 0) - (before.totalPoints || 0);
    if (ptsChange === 0) return null;

    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthRef = db.collection('monthly_history').doc(`${userId}_${month}`);

    await monthRef.set({
      userId,
      customerId: after.customerId || userId,
      month,
      pointsEarned: admin.firestore.FieldValue.increment(Math.max(0, ptsChange)),
      recruits:     admin.firestore.FieldValue.increment(
        (after.directRecruits || 0) > (before.directRecruits || 0) ? 1 : 0
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return null;
  });


// ══════════════════════════════════════════════════════════════
// 4. scheduledMonthlyReset — runs on 1st of every month at 00:00
//    Resets all points and global stats
// ══════════════════════════════════════════════════════════════
exports.scheduledMonthlyReset = functions.pubsub
  .schedule('0 0 1 * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    console.log('Running scheduled monthly reset…');

    // Reset global stats
    await db.collection('global_stats').doc('main').set({
      globalPool:         0,
      totalNetworkPoints: 0,
      teamSupportPoints:  0,
      newPartners:        0,
      lastReset:          admin.firestore.FieldValue.serverTimestamp(),
    });

    // Reset all users in batches of 400
    const usersSnap = await db.collection('users').get();
    const BATCH = 400;
    for (let i = 0; i < usersSnap.docs.length; i += BATCH) {
      const batch = db.batch();
      usersSnap.docs.slice(i, i + BATCH).forEach(doc => {
        batch.update(doc.ref, {
          directPoints:      0,
          firstOrbitPoints:  0,
          secondOrbitPoints: 0,
          totalPoints:       0,
          directRecruits:    0,
        });
      });
      await batch.commit();
    }

    console.log(`Monthly reset complete. Affected ${usersSnap.size} users.`);
    return null;
  });


// ══════════════════════════════════════════════════════════════
// 5. getLeaderboard — HTTPS endpoint for paginated leaderboard
//    (useful for external integrations)
// ══════════════════════════════════════════════════════════════
exports.getLeaderboard = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const limit  = parseInt(req.query.limit)  || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const snap = await db.collection('users')
      .orderBy('totalPoints', 'desc')
      .limit(limit)
      .get();

    const rows = snap.docs.map((d, i) => {
      const u = d.data();
      return {
        rank:               offset + i + 1,
        name:               u.displayName || 'Unknown',
        customerId:         u.customerId  || d.id,
        directPoints:       u.directPoints      || 0,
        directRecruits:     u.directRecruits    || 0,
        firstOrbitPoints:   u.firstOrbitPoints  || 0,
        secondOrbitPoints:  u.secondOrbitPoints || 0,
        totalPoints:        u.totalPoints       || 0,
      };
    });
    res.status(200).json({ leaderboard: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
