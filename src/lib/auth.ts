import { createHmac, timingSafeEqual } from 'crypto';
import { compareSync } from 'bcryptjs';
import type { AstroCookies } from 'astro';
import { getDb } from './db';

const SESSION_COOKIE = 'admin_session';

// Load secret from environment; fall back to a build-time constant in dev only.
// In production, set SESSION_SECRET in your environment/deployment config.
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'ligao559-admin-dev-secret-fallback';

function sign(username: string): string {
  const payload = Buffer.from(username).toString('base64url');
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token: string): string | null {
  try {
    const dotIdx = token.indexOf('.');
    if (dotIdx === -1) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function loginUser(username: string, password: string): string | null {
  const db = getDb();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as { username: string; password: string } | undefined;
  if (!user) return null;
  if (!compareSync(password, user.password)) return null;
  return sign(username);
}

export function getSessionUser(cookies: AstroCookies): string | null {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  return getSessionUser(cookies) !== null;
}

export function setSessionCookie(cookies: AstroCookies, token: string) {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Set COOKIE_SECURE=true in your env only when serving over HTTPS.
    // Leaving it unset (HTTP/local) allows the cookie to work without SSL.
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export { SESSION_COOKIE };
