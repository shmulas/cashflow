# Firebase Auth — Cashflow Dashboard

**Date:** 2026-05-14
**Status:** Approved

## Goal

Restrict the cashflow dashboard to exactly 2 authorized Google accounts. Anyone else — even with a valid Google account — gets a 403 and never receives the Supabase credentials.

## Security Model

The Supabase `anon` key is the gateway to all data. Currently it is returned unconditionally by `/api/config`. After this change, `/api/config` will only return the key if the request includes a valid Firebase ID token whose email is in the `ALLOWED_EMAILS` env var.

```
Unauthorized user:
  GET /api/config (no token / wrong email) → 403 → no Supabase key → no data access

Authorized user:
  1. Google Sign-In popup → Firebase issues ID token
  2. GET /api/config + Bearer <token> → server verifies + checks email → returns {url, key}
  3. Dashboard loads normally
```

No Firebase Admin SDK is needed. Firebase ID tokens are signed JWTs; the server validates them by fetching Google's public JWKS from a well-known URL and verifying the RS256 signature. This keeps the Vercel function dependency-free.

## Components

### 1. `api/config.js` (modified)

- Extract `Authorization: Bearer <token>` header
- If missing → 401
- Fetch Google public keys from `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
- Verify JWT signature + `aud` = `FIREBASE_PROJECT_ID` + `exp` not expired
- Extract `email` from payload
- Check `email` against `ALLOWED_EMAILS` (comma-separated env var)
- If not in list → 403 `{ error: 'אין גישה' }`
- If authorized → return `{ url, key }` as before

### 2. `index.html` (modified)

**Login screen** (shown before dashboard):
- Centered card, Hebrew RTL
- "התחבר עם Google" button (Firebase `signInWithPopup`)
- On success → get `idToken` → call `/api/config` with token
- On 403 → show "אין לך גישה לדשבורד זה" message
- On success → store `{url, key}` in memory → hide login → show dashboard

**Auth state**:
- `let firebaseToken = null` — refreshed before each `/api/config` call if needed
- Firebase `onAuthStateChanged` — if user already signed in (session persisted), auto-fetch config on load
- "התנתק" button added to dashboard header

**Firebase SDK**: Load only `firebase-app` + `firebase-auth` from CDN (compat v9 UMD, ~50KB gzipped). No other Firebase modules.

### 3. New Vercel env vars

| Variable | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID (e.g. `cashflow-12345`) |
| `ALLOWED_EMAILS` | `shmulik.a@playscape.co.il,guy.y@playscape.co.il` |

### 4. Firebase Console setup (manual, one-time)

1. Create Firebase project (or use existing)
2. Enable **Google** sign-in provider under Authentication → Sign-in method
3. Add the Vercel deployment domain to **Authorized domains**
4. Copy `apiKey`, `authDomain`, `projectId` into `index.html` Firebase config

## Data Flow After Auth

The `db()` helper in `index.html` currently uses module-level `BASE` and `KEY` variables set from `/api/config`. After auth:

- `/api/config` is called once on login with the Firebase token
- `BASE` and `KEY` are set exactly as before
- All subsequent Supabase calls (loans, income, banks, etc.) are unchanged

Token refresh: Firebase ID tokens expire after 1 hour. If a Supabase call fails with 401, re-fetch `/api/config` with a fresh token (`user.getIdToken(true)`). For a dashboard used in short sessions this edge case is acceptable to handle with a page reload prompt.

## Error States

| Scenario | UI |
|---|---|
| Not signed in | Login screen |
| Signed in, wrong email | "אין לך גישה לדשבורד זה" + logout button |
| Network error during config fetch | "שגיאת חיבור, נסה שוב" |
| Firebase sign-in cancelled | Stay on login screen |

## Files Changed

- `api/config.js` — add token verification + email whitelist check
- `index.html` — add Firebase SDK, login screen, auth state management
- `vercel.json` — no changes needed
- Vercel env vars — add `FIREBASE_PROJECT_ID`, `ALLOWED_EMAILS`

## Out of Scope

- Supabase Row Level Security (the anon key is now protected server-side; RLS would be a separate hardening step)
- Multiple sign-in methods (Google only)
- User management UI (2 fixed emails, no self-service)
