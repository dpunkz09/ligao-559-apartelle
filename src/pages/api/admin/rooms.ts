import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, extname } from 'path';
import { randomBytes } from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function isValidImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

// PUT: update a room (full replace)
export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { id?: number; name?: string; description?: string; image?: string; badge?: string; features?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (body.id == null) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  try {
    const db = getDb();

    if (body.name !== undefined || body.description !== undefined || body.image !== undefined || body.badge !== undefined) {
      db.prepare(`
        UPDATE rooms SET
          name        = COALESCE(?, name),
          description = COALESCE(?, description),
          image       = COALESCE(?, image),
          badge       = COALESCE(?, badge)
        WHERE id = ?
      `).run(body.name ?? null, body.description ?? null, body.image ?? null, body.badge ?? null, body.id);
    }

    if (Array.isArray(body.features)) {
      db.prepare('DELETE FROM room_features WHERE room_id = ?').run(body.id);
      const ins = db.prepare('INSERT INTO room_features (room_id, feature, sort_order) VALUES (?, ?, ?)');
      for (const [i, feat] of body.features.entries()) ins.run(body.id, String(feat).slice(0, 200), i);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on room PUT:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// POST: upload room image
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const roomId = Number(form.get('room_id'));

  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: 'No file' }), { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: 'File too large (max 5 MB)' }), { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isValidImageBuffer(buffer)) {
    return new Response(JSON.stringify({ error: 'Invalid image file' }), { status: 400 });
  }

  const UPLOAD_DIR = resolve(process.cwd(), 'public', 'images');
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(file.name).toLowerCase())
    ? extname(file.name).toLowerCase() : '.jpg';
  const filename = `room_${randomBytes(8).toString('hex')}${ext}`;

  try {
    writeFileSync(resolve(UPLOAD_DIR, filename), buffer);
  } catch (err) {
    console.error('Failed to write room image:', err);
    return new Response(JSON.stringify({ error: 'Failed to save file' }), { status: 500 });
  }

  const src = `/images/${filename}`;
  try {
    if (roomId) {
      getDb().prepare('UPDATE rooms SET image = ? WHERE id = ?').run(src, roomId);
    }
    return new Response(JSON.stringify({ ok: true, src }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on room image update:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
