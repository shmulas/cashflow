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
