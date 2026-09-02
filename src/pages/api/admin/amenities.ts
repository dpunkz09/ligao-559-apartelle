import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getDb } from '../../../lib/db';

// PUT: update single amenity
export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { id?: number; icon?: string; title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (body.id == null) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  try {
    getDb().prepare(`
      UPDATE amenities SET
        icon        = COALESCE(?, icon),
        title       = COALESCE(?, title),
        description = COALESCE(?, description)
      WHERE id = ?
    `).run(body.icon ?? null, body.title ?? null, body.description ?? null, body.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on amenity PUT:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// POST: add new amenity
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { icon?: string; title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  try {
    const db = getDb();
    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM amenities').get() as { m: number | null }).m ?? 0;
    const result = db.prepare('INSERT INTO amenities (icon, title, description, sort_order) VALUES (?, ?, ?, ?)').run(
      String(body.icon ?? 'auto_awesome').slice(0, 50),
      String(body.title ?? 'New Amenity').slice(0, 100),
      String(body.description ?? '').slice(0, 300),
      maxOrder + 1
    );

    return new Response(JSON.stringify({ ok: true, id: result.lastInsertRowid }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('DB error on amenity POST:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// DELETE: remove amenity
export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { id?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (body.id == null) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  try {
    getDb().prepare('DELETE FROM amenities WHERE id = ?').run(body.id);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on amenity DELETE:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
