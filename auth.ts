// Device-local accounts: email + password, password stored only as a salted PBKDF2 hash in this browser.
// NOTE: this is NOT a server login. Accounts and data live on this device/browser only and do not sync.
export type User = { id: string; email: string };
type StoredUser = User & { salt: string; hash: string };

const USERS_KEY = 'nutritrack-users';
const SESSION_KEY = 'nutritrack-session';
const toHex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from((h.match(/../g) ?? []).map(x => parseInt(x, 16)));

function readUsers(): StoredUser[] {
  try {
    const v = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return Array.isArray(v) ? v.filter(u => u && typeof u.id === 'string' && typeof u.email === 'string' && typeof u.salt === 'string' && typeof u.hash === 'string') : [];
  } catch { return []; }
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('Secure login needs https. Please open the app through its https address.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: 210000, hash: 'SHA-256' }, key, 256);
  return toHex(new Uint8Array(bits));
}

export function getSession(): User | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const u = readUsers().find(x => x.id === id);
    return u ? { id: u.id, email: u.email } : null;
  } catch { return null; }
}

export async function register(emailRaw: string, password: string): Promise<User> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const users = readUsers();
  if (users.some(u => u.email === email)) throw new Error('An account with this email already exists. Try logging in.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const id = toHex(crypto.getRandomValues(new Uint8Array(12)));
  const hash = await hashPassword(password, salt);
  if (users.length === 0) { // first account on this device adopts any data saved by the older single-user version
    for (const name of ['meals', 'water', 'goals']) {
      const old = localStorage.getItem(`nutritrack-${name}`);
      if (old) localStorage.setItem(`nutritrack-${id}-${name}`, old);
    }
  }
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, { id, email, salt, hash }]));
  localStorage.setItem(SESSION_KEY, id);
  return { id, email };
}

export async function login(emailRaw: string, password: string): Promise<User> {
  const email = emailRaw.trim().toLowerCase();
  const u = readUsers().find(x => x.email === email);
  const bad = new Error('Incorrect email or password.');
  if (!u) throw bad;
  if ((await hashPassword(password, u.salt)) !== u.hash) throw bad;
  localStorage.setItem(SESSION_KEY, u.id);
  return { id: u.id, email: u.email };
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
