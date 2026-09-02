import type { APIRoute } from 'astro';
import { isAuthenticated, getSessionUser } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { compareSync, hashSync } from 'bcryptjs';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const username = getSessionUser(cookies);
  if (!username) {
    return new Response(JSON.stringify({ error: 'Session invalid' }), { status: 401 });
  }

  const body = await request.json() as {
    current_password: string;
    new_password: string;
    confirm_password: string;
  };

  if (!body.current_password || !body.new_password || !body.confirm_password) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), { status: 400 });
  }

  if (body.new_password !== body.confirm_password) {
    return new Response(JSON.stringify({ error: 'New passwords do not match.' }), { status: 400 });
  }

  if (body.new_password.length < 6) {
    return new Response(JSON.stringify({ error: 'New password must be at least 6 characters.' }), { status: 400 });
  }

  const db = getDb();
  const user = db.prepare('SELECT password FROM admin_users WHERE username = ?').get(username) as { password: string } | undefined;

  if (!user || !compareSync(body.current_password, user.password)) {
    return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), { status: 400 });
  }

  db.prepare('UPDATE admin_users SET password = ? WHERE username = ?').run(hashSync(body.new_password, 10), username);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
