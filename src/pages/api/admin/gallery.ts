import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { captureAdminEvent } from '../../../lib/posthog-server';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, extname } from 'path';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = resolve(process.cwd(), 'public', 'images');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function safeExt(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
}

/** Validate image magic bytes: JPEG, PNG, WebP, GIF */
function isValidImageBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  return isJpeg || isPng || isWebp || isGif;
}

// POST: upload new photo
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const alt = String(form.get('alt') ?? '').slice(0, 200);
  const caption = String(form.get('caption') ?? '').slice(0, 200);
  const isFeatured = form.get('is_featured') === '1' ? 1 : 0;

  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return new Response(JSON.stringify({ error: 'File too large (max 5 MB)' }), { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isValidImageBuffer(buffer)) {
    return new Response(JSON.stringify({ error: 'Invalid image file' }), { status: 400 });
  }

  mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = safeExt(file.name);
  const filename = `photo_${randomBytes(8).toString('hex')}${ext}`;
  const filepath = resolve(UPLOAD_DIR, filename);

  try {
    writeFileSync(filepath, buffer);
  } catch (err) {
    console.error('Failed to write upload file:', err);
    return new Response(JSON.stringify({ error: 'Failed to save file' }), { status: 500 });
  }

  try {
    const db = getDb();
    const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM gallery').get() as { m: number | null }).m ?? 0;
    const result = db.prepare(
      'INSERT INTO gallery (src, alt, caption, is_featured, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(`/images/${filename}`, alt, caption, isFeatured, maxOrder + 1);
    await captureAdminEvent(cookies, 'gallery_photo_uploaded', { is_featured: isFeatured === 1 });

    return new Response(JSON.stringify({ ok: true, id: result.lastInsertRowid, src: `/images/${filename}` }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('DB error on gallery insert:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// PATCH: update photo meta or reorder
export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: { id?: number; alt?: string; caption?: string; is_featured?: number; sort_order?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (body.id == null) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }

  const fields: string[] = [];
  const vals: unknown[] = [];

  if (body.alt !== undefined) { fields.push('alt = ?'); vals.push(String(body.alt).slice(0, 200)); }
  if (body.caption !== undefined) { fields.push('caption = ?'); vals.push(String(body.caption).slice(0, 200)); }
  if (body.is_featured !== undefined) {
    if (body.is_featured === 1) {
      try { getDb().prepare('UPDATE gallery SET is_featured = 0').run(); } catch {}
    }
    fields.push('is_featured = ?'); vals.push(body.is_featured);
  }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); vals.push(body.sort_order); }

  if (fields.length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), { status: 400 });
  }

  try {
    vals.push(body.id);
    getDb().prepare(`UPDATE gallery SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    if (body.is_featured === 1) await captureAdminEvent(cookies, 'gallery_photo_featured');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on gallery PATCH:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};

// DELETE: remove photo
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
    const db = getDb();
    const photo = db.prepare('SELECT src FROM gallery WHERE id = ?').get(body.id) as { src: string } | undefined;

    // Attempt file deletion BEFORE the DB record (so we don't lose the path on failure)
    if (photo?.src?.startsWith('/images/photo_')) {
      try {
        unlinkSync(resolve(process.cwd(), 'public', photo.src.slice(1)));
      } catch (e) {
        console.warn('Could not delete gallery file:', e);
      }
    }

    db.prepare('DELETE FROM gallery WHERE id = ?').run(body.id);
    await captureAdminEvent(cookies, 'gallery_photo_deleted');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('DB error on gallery DELETE:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
