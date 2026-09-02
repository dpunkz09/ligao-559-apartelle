import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getDb, setSetting } from '../../../lib/db';
import { captureAdminEvent } from '../../../lib/posthog-server';

const ALLOWED_KEYS = new Set([
  'site_title', 'site_description',
  'hero_badge', 'hero_headline', 'hero_subheadline', 'hero_bg_image',
  'phone', 'address', 'facebook_url', 'maps_url', 'maps_embed_url',
  'brand_color', 'brand_color_dark',
  'open_hours', 'rooms_heading', 'rooms_subtext',
  'amenities_heading', 'amenities_subtext',
  'cta_heading', 'cta_subtext',
]);

// Max character lengths per key (prevents abuse of text fields)
const MAX_LENGTHS: Record<string, number> = {
  site_title: 120,
  site_description: 500,
  hero_badge: 120,
  hero_headline: 100,
  hero_subheadline: 500,
  hero_bg_image: 300,
  phone: 30,
  address: 300,
  facebook_url: 300,
  maps_url: 500,
  maps_embed_url: 1000,
  brand_color: 7,
  brand_color_dark: 7,
  open_hours: 100,
  rooms_heading: 150,
  rooms_subtext: 300,
  amenities_heading: 150,
  amenities_subtext: 300,
  cta_heading: 150,
  cta_subtext: 300,
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  try {
    const db = getDb();

    for (const [key, rawValue] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue;

      const value = String(rawValue ?? '');
      const maxLen = MAX_LENGTHS[key] ?? 500;

      // Validate hex colors
      if ((key === 'brand_color' || key === 'brand_color_dark') && !HEX_COLOR_RE.test(value)) {
        continue; // silently skip invalid colors
      }

      setSetting(db, key, value.slice(0, maxLen));
    }

    await captureAdminEvent(cookies, 'site_settings_saved', {
      setting_count: Object.keys(body).filter((key) => ALLOWED_KEYS.has(key)).length,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('DB error on settings POST:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
};
