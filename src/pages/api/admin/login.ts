import type { APIRoute } from 'astro';
import { loginUser, setSessionCookie } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

// In-memory rate limiter: max 5 attempts per IP per 15 minutes
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_ATTEMPTS) return true;

  entry.count++;
  return false;
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Too many failed attempts. Please wait 15 minutes before trying again.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '900' },
    });
  }

  const form = await request.formData();
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');

  const token = loginUser(username, password);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Invalid username or password.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Clear the counter on successful login
  clearAttempts(ip);
  setSessionCookie(cookies, token);
  const user = getDb()
    .prepare('SELECT id FROM admin_users WHERE username = ?')
    .get(username) as { id: number } | undefined;

  if (!user) {
    return new Response(JSON.stringify({ error: 'Admin account not found.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, userId: user.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
