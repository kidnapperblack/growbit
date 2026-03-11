# GROWBIT — Full-Stack Firebase Platform

## 📁 Project Structure

```
growbit/
├── public/                   # Frontend (Firebase Hosting)
│   ├── index.html            # Main public page (stats + leaderboard)
│   ├── login.html            # Authentication (login + password reset)
│   ├── dashboard.html        # User dashboard (post-login)
│   ├── admin.html            # Admin control panel
│   └── firebase-config.js   # Firebase SDK config (UPDATE THIS)
│
├── functions/                # Cloud Functions (Node.js 18)
│   ├── src/
│   │   └── index.js          # All Cloud Functions
│   └── package.json
│
├── firestore/
│   ├── firestore.rules       # Security rules
│   ├── firestore.indexes.json
│   └── schema.js             # Schema docs + seed script
│
└── firebase.json             # Firebase project config
```

---

## 🚀 Setup Steps

### 1. Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. `growbit-app`)
3. Enable **Firestore Database** (start in production mode)
4. Enable **Firebase Authentication** → Email/Password
5. Enable **Firebase Hosting**

### 2. Configure Firebase SDK
Edit `public/firebase-config.js` with your project's values:
```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Also update `YOUR_PROJECT_ID` in `public/admin.html` line with `cloudfunctions.net/createUser`.

### 3. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 4. Init & Deploy

```bash
cd growbit
firebase use --add   # Select your project

# Install function dependencies
cd functions && npm install && cd ..

# Deploy everything
firebase deploy
```

### 5. Seed Database
```bash
cd firestore
# Add your service account key as serviceAccountKey.json
# Uncomment the seed() call in schema.js, then:
node schema.js
```

### 6. Create Admin User
1. Go to Firebase Console → Authentication → Add user
2. Register with email/password
3. Go to Firestore → `users` → find that user's UID doc
4. Set `role: "admin"`
5. Login at `your-domain/login.html` → will redirect to admin panel

---

## 🔥 Features

| Feature | Implementation |
|---------|---------------|
| Global Stats Panel | Firestore real-time listener on `global_stats/main` |
| Animated Leaderboard | Real-time ordered query on `users` by `totalPoints DESC` |
| Authentication | Firebase Auth Email/Password + session persistence |
| Password Reset | Firebase Auth `sendPasswordResetEmail()` |
| User Dashboard | Real-time user doc + orbit calculations |
| First Orbit | `users` where `recruitedBy == userCid` |
| Second Orbit | Recursive: FO members' FO members |
| Point Distribution | Cloud Function trigger on `recruitments` doc create |
| Auto User ID | Transaction-safe counter → `GG20100, GG20101…` |
| Monthly History | `monthly_history` updated by `onUpdate` trigger |
| Charts | Chart.js bar + line combo |
| Admin Panel | Role-based access (role == 'admin') |
| Master Reset | Re-auth + batch write to 0 + admin password confirm |
| Products | Admin CRUD → public display |
| Rewards | Admin CRUD → authenticated display |

---

## 💡 Point Distribution Rules

```
Ram (GG20100)
  └── Karan (GG20101) ← recruited by Ram
        └── Rohit (GG20102) ← recruited by Karan
              └── Rani (GG20103) ← recruited by Rohit

When Karan recruits someone:
  → Ram gets +2 pts (direct recruit bonus)

When Rohit recruits someone:
  → Karan gets +2 pts (level 1)
  → Ram gets +1 pt   (level 2)

When Rani recruits someone:
  → Rohit gets +2 pts (level 1)
  → Karan gets +1 pt  (level 2)
  → Ram gets 0        (beyond 2 levels)
```

Points only propagate **2 levels** up the recruitment chain.

---

## 🗄️ Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles, points, roles |
| `global_stats` | Network-wide counters + ID counter |
| `recruitments` | Recruitment events (triggers Cloud Functions) |
| `points_history` | Audit log of all point changes |
| `monthly_history` | Monthly aggregates per user (for charts) |
| `products` | Product catalogue |
| `rewards` | Reward catalogue |

---

## ⚡ Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `createUser` | HTTPS POST | Create user + generate GG ID |
| `onRecruitmentAdded` | Firestore onCreate | Distribute +2/+1 points |
| `updateMonthlyHistory` | Firestore onUpdate | Update monthly stats |
| `scheduledMonthlyReset` | Pub/Sub (1st of month) | Auto monthly reset |
| `getLeaderboard` | HTTPS GET | Paginated leaderboard API |

---

## 🔐 Security

- Firestore rules enforce role-based access
- Admin panel redirects non-admins to login
- Master Reset requires admin password re-authentication
- All Cloud Functions use Firebase Admin SDK (bypasses client rules)
- Firestore persistence enabled for offline support

---

## 📈 Performance at Scale

- Leaderboard uses Firestore ordered index on `totalPoints DESC`
- Batch writes (400 docs/batch) for monthly reset
- Paginated leaderboard API for thousands of users
- Composite Firestore indexes pre-configured in `firestore.indexes.json`
- Real-time listeners auto-disconnect when tabs close

---

*Built with Firebase + TailwindCSS · Growbit Private Limited*
