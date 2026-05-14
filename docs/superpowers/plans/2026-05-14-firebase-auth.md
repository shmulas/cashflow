# Firebase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict the cashflow dashboard to exactly 2 Google accounts (`shmulik.a@playscape.co.il`, `guy.y@playscape.co.il`) by gating `/api/config` behind Firebase JWT verification.

**Architecture:** Firebase Google Sign-In runs in the browser; after login the client sends the Firebase ID token to `/api/config`; the server verifies the JWT using Node.js built-in `crypto` against Google's public keys and checks the email against `ALLOWED_EMAILS` env var; only then does it return Supabase credentials. No npm packages needed — zero new dependencies.

**Tech Stack:** Firebase Auth (compat v10 UMD CDN), Node.js `crypto` module (built-in), Vercel env vars

---

## File Map

| File | Change |
|---|---|
| `api/config.js` | Replace with JWT-verifying, email-checking version |
| `index.html` | Add Firebase SDK scripts, login screen HTML+CSS, auth JS, sign-out button |

---

## Task 1: Firebase Console Setup (manual, one-time)

**Files:** None — browser-only configuration

- [ ] **Step 1: Create Firebase project**

  Go to https://console.firebase.google.com → "Add project" → name it `cashflow-dashboard` → disable Google Analytics → Create project.

- [ ] **Step 2: Enable Google sign-in**

  In Firebase Console: Authentication → Sign-in method → Google → Enable → set Project support email → Save.

- [ ] **Step 3: Add authorized domain**

  Authentication → Settings → Authorized domains → Add domain → enter your Vercel domain (e.g. `cashflow-abc.vercel.app`). Also add `localhost` for local testing.

- [ ] **Step 4: Copy Firebase config**

  Project Settings (gear icon) → General → scroll to "Your apps" → Web app → Register app (name: `cashflow`) → copy the config object. You will need these values in Task 3:

  ```js
  // Example shape — yours will have real values
  {
    apiKey: "AIzaSy...",
    authDomain: "cashflow-XXXXX.firebaseapp.com",
    projectId: "cashflow-XXXXX"
  }
  ```

  Save these somewhere — you'll paste them into `index.html` in Task 3.

- [ ] **Step 5: Note the Project ID**

  The `projectId` value (e.g. `cashflow-12345`) is what you'll set as `FIREBASE_PROJECT_ID` in Vercel env vars in Task 4.

---

## Task 2: Update `api/config.js`

**Files:**
- Modify: `api/config.js`

- [ ] **Step 1: Replace the entire file**

  Open `api/config.js` and replace its full contents with:

  ```js
  const crypto = require('crypto');

  let _cachedKeys = null;
  let _keyCacheExpiry = 0;

  async function getPublicKeys() {
    if (_cachedKeys && Date.now() < _keyCacheExpiry) return _cachedKeys;
    const r = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!r.ok) throw new Error('Failed to fetch Firebase public keys');
    _cachedKeys = await r.json();
    _keyCacheExpiry = Date.now() + 60 * 60 * 1000;
    return _cachedKeys;
  }

  function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
  }

  async function verifyFirebaseToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');

    const header = JSON.parse(b64urlDecode(parts[0]).toString());
    const payload = JSON.parse(b64urlDecode(parts[1]).toString());

    if (header.alg !== 'RS256') throw new Error('Invalid algorithm');
    if (!header.kid) throw new Error('Missing kid');

    const keys = await getPublicKeys();
    const cert = keys[header.kid];
    if (!cert) throw new Error('Unknown kid');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    if (!verifier.verify(cert, b64urlDecode(parts[2]))) throw new Error('Bad signature');

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) throw new Error('Token expired');

    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (payload.aud !== projectId) throw new Error('Invalid aud');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Invalid iss');

    return payload;
  }

  module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = await verifyFirebaseToken(token);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token: ' + e.message });
    }

    const email = (payload.email || '').toLowerCase();
    const allowed = (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase());

    if (!allowed.includes(email)) {
      return res.status(403).json({ error: 'אין גישה' });
    }

    res.json({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY });
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add api/config.js
  git commit -m "feat: gate /api/config behind Firebase JWT + email whitelist"
  ```

---

## Task 3: Update `index.html` — Firebase SDK + Login Screen

**Files:**
- Modify: `index.html`

### Part A: Add Firebase scripts to `<head>`

- [ ] **Step 1: Add scripts after the Chart.js script tag**

  Find this line in `<head>`:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
  ```

  Add immediately after it:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  ```

### Part B: Add login screen CSS

- [ ] **Step 2: Add CSS before the closing `</style>` tag**

  Find `</style>` and add before it:
  ```css
  #loginScreen{position:fixed;inset:0;background:#f8f8f6;display:flex;align-items:center;justify-content:center;z-index:1000}
  #loginScreen.hidden{display:none}
  .login-card{background:#fff;border:0.5px solid #e0e0e0;border-radius:12px;padding:2rem 2.5rem;width:300px;text-align:center}
  .login-card h2{font-size:16px;font-weight:500;margin-bottom:6px}
  .login-card .sub{font-size:12px;color:#666;margin-bottom:1.5rem}
  #loginError{color:#E24B4A;font-size:12px;margin-top:10px;min-height:16px}
  .header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
  .header-row h1{margin-bottom:0}
  ```

### Part C: Add login screen HTML + update header

- [ ] **Step 3: Add login screen div immediately after `<body>`**

  Find `<body>` and add right after it (before `<div class="container">`):
  ```html
  <div id="loginScreen">
    <div class="login-card">
      <h2>דשבורד תזרים מזומנים</h2>
      <p class="sub">כניסה לאנשים מורשים בלבד</p>
      <button id="loginBtn" class="primary" onclick="signIn()">
        <i class="ti ti-brand-google"></i> התחבר עם Google
      </button>
      <div id="loginError"></div>
    </div>
  </div>
  ```

- [ ] **Step 4: Wrap the existing `<h1>` in a `header-row` div + add sign-out button**

  Find:
  ```html
  <h1><i class="ti ti-chart-bar" aria-hidden="true"></i> דשבורד תזרים מזומנים</h1>
  ```

  Replace with:
  ```html
  <div class="header-row">
    <h1><i class="ti ti-chart-bar" aria-hidden="true"></i> דשבורד תזרים מזומנים</h1>
    <button onclick="signOut()" style="font-size:12px"><i class="ti ti-logout"></i> יציאה</button>
  </div>
  ```

### Part D: Replace the IIFE with Firebase auth logic

- [ ] **Step 5: Replace the bottom IIFE**

  Find and remove this block (near the bottom of the `<script>` tag):
  ```js
  (async()=>{
    try{
      const cfg=await fetch('/api/config').then(r=>r.json());
      BASE=cfg.url;KEY=cfg.key;
    }catch(e){console.error('Config fetch failed',e);}
    ['salMonth','ccMonth','incMonth','otherMonth'].forEach(buildMonthOptions);
    loadAll();
  })();
  ```

  Replace it with:
  ```js
  // Replace YOUR_* values with values from Firebase Console (Task 1, Step 4)
  firebase.initializeApp({
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
  });
  const _auth = firebase.auth();

  function signIn() {
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'מתחבר...';
    _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch(() => {
        document.getElementById('loginError').textContent = 'שגיאה בהתחברות, נסה שוב';
        btn.disabled = false;
        btn.innerHTML = '<i class="ti ti-brand-google"></i> התחבר עם Google';
      });
  }

  async function signOut() {
    await _auth.signOut();
  }

  _auth.onAuthStateChanged(async (user) => {
    if (!user) {
      document.getElementById('loginScreen').classList.remove('hidden');
      return;
    }
    document.getElementById('loginError').textContent = '';
    try {
      const token = await user.getIdToken();
      const r = await fetch('/api/config', { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 403) {
        document.getElementById('loginError').textContent = 'אין לך גישה לדשבורד זה';
        await _auth.signOut();
        return;
      }
      if (!r.ok) throw new Error('config fetch failed');
      const cfg = await r.json();
      BASE = cfg.url;
      KEY = cfg.key;
      document.getElementById('loginScreen').classList.add('hidden');
      ['salMonth','ccMonth','incMonth','otherMonth'].forEach(buildMonthOptions);
      loadAll();
    } catch (e) {
      document.getElementById('loginError').textContent = 'שגיאת חיבור, נסה שוב';
      await _auth.signOut();
    }
  });
  ```

- [ ] **Step 6: Fill in your Firebase config values**

  In the code you just added, replace the three placeholder strings with the real values from Task 1 Step 4:
  - `"YOUR_API_KEY"` → your `apiKey`
  - Both `"YOUR_PROJECT_ID"` → your `projectId`

- [ ] **Step 7: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add Firebase Google auth login screen"
  ```

---

## Task 4: Set Vercel Environment Variables

**Files:** None — Vercel dashboard configuration

- [ ] **Step 1: Add `FIREBASE_PROJECT_ID`**

  Vercel Dashboard → your cashflow project → Settings → Environment Variables → Add:
  - Key: `FIREBASE_PROJECT_ID`
  - Value: your Firebase project ID (e.g. `cashflow-12345`)
  - Environment: Production, Preview, Development

- [ ] **Step 2: Add `ALLOWED_EMAILS`**

  Add another env var:
  - Key: `ALLOWED_EMAILS`
  - Value: `shmulik.a@playscape.co.il,guy.y@playscape.co.il`
  - Environment: Production, Preview, Development

- [ ] **Step 3: Redeploy**

  Push to trigger a new Vercel deploy (or manually trigger in Vercel dashboard). New env vars only take effect after redeploy.

  ```bash
  git push
  ```

---

## Task 5: Manual Verification

- [ ] **Test 1 — Unauthorized access blocked**

  Open the site URL in an incognito window. You should see the login screen (the dashboard is completely hidden). Open DevTools → Network → call `fetch('/api/config')` directly from console — it should return `401 Missing token`.

- [ ] **Test 2 — Wrong email blocked**

  Sign in with a Google account that is NOT `shmulik.a@playscape.co.il` or `guy.y@playscape.co.il`. The login screen should show "אין לך גישה לדשבורד זה" and stay on the login screen. DevTools → Network → verify `/api/config` returned `403`.

- [ ] **Test 3 — Authorized user succeeds**

  Sign in with `shmulik.a@playscape.co.il`. Dashboard should load with all data intact. KPIs, chart, loans table — everything should work exactly as before.

- [ ] **Test 4 — Second authorized user**

  Sign in with `guy.y@playscape.co.il` in a separate browser. Dashboard loads normally.

- [ ] **Test 5 — Session persistence**

  After signing in, close and reopen the tab. You should land directly on the dashboard (no login screen) — Firebase persists the session automatically.

- [ ] **Test 6 — Sign out**

  Click the "יציאה" button. Login screen reappears.

- [ ] **Test 7 — Supabase key not in source**

  Open DevTools → Sources → search for the Supabase anon key string in `index.html`. It must NOT be found there. It only arrives at runtime after auth succeeds.
