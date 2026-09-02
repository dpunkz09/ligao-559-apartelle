import Database from 'better-sqlite3';
import { resolve } from 'path';
import { hashSync } from 'bcryptjs';

const DB_PATH = resolve(process.cwd(), 'data', 'site.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image       TEXT NOT NULL DEFAULT '',
      badge       TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS room_features (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      feature TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS amenities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      icon       TEXT NOT NULL DEFAULT '',
      title      TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      src        TEXT NOT NULL,
      alt        TEXT NOT NULL DEFAULT '',
      caption    TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  seed(db);
}

function seed(db: Database.Database) {
  // Seed settings if empty
  const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c;
  if (settingsCount === 0) {
    const defaults: Record<string, string> = {
      site_title: 'Ligao 559 Apartelle – Nice & Relax',
      site_description: 'Affordable, comfortable lodging with private garages in Brgy. Tomolin, Ligao City, Albay. Book your stay at 559 Apartelle today. Call 0919-782-6430.',
      hero_badge: 'Now Accepting Guests · Ligao City, Albay',
      hero_headline: 'Nice & Relax',
      hero_subheadline: 'Comfortable, affordable rooms with private garages in the heart of Tomolin, Ligao City. Perfect for families, travelers, and long-stay guests.',
      hero_bg_image: '/images/entrance.jpg',
      phone: '0919-782-6430',
      address: 'Brgy. Tomolin, Ligao City, Albay, Philippines',
      facebook_url: 'https://www.facebook.com/profile.php?id=100057213410203',
      maps_url: 'https://maps.app.goo.gl/1mXPt78aRWwsdsex7',
      maps_embed_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3879.3!2d123.4844!3d13.2178!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a19b2dfbf6c6c5%3A0x7c559ad35cb16f74!2s559%20Apartelle!5e0!3m2!1sen!2sph!4v1',
      brand_color: '#e91e8c',
      brand_color_dark: '#c4156f',
      open_hours: 'Open 24/7',
      rooms_heading: 'Comfortable Rooms for Every Guest',
      rooms_subtext: "Whether you're passing through or staying for weeks, we have a space that fits your needs and budget.",
      amenities_heading: 'Amenities & Features',
      amenities_subtext: 'Everything you need for a pleasant, stress-free stay — all included.',
      cta_heading: 'Ready to Book Your Stay?',
      cta_subtext: "Call us now and we'll get your room ready.",
    };
    const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
  }

  // Seed rooms if empty
  const roomsCount = (db.prepare('SELECT COUNT(*) as c FROM rooms').get() as { c: number }).c;
  if (roomsCount === 0) {
    const insRoom = db.prepare('INSERT INTO rooms (name, description, image, badge, sort_order) VALUES (?, ?, ?, ?, ?)');
    const insFeat = db.prepare('INSERT INTO room_features (room_id, feature, sort_order) VALUES (?, ?, ?)');

    const rooms = [
      {
        name: 'Standard Room',
        description: 'Cozy and well-ventilated room perfect for solo travelers or couples.',
        image: '/images/room-beds.jpg',
        badge: '',
        features: ['Single/Double Bed', 'Ceiling Fan', 'Wood-tile Flooring', 'Clean Linens', 'Window Ventilation'],
      },
      {
        name: 'Family Room',
        description: 'Spacious room ideal for families and groups. Multiple beds, a couch, wall-mounted TV, and a dining area.',
        image: '/images/room-sala.jpg',
        badge: 'Most Popular',
        features: ['Multiple Beds', 'Wall-mounted TV', 'Sofa / Lounge Area', 'Dining Table & Chairs', 'Ceiling Fan', 'Ample Space'],
      },
      {
        name: 'Unit with Garage',
        description: "All units come with a dedicated covered parking space right at your door.",
        image: '/images/garage.jpg',
        badge: 'Included in All Units',
        features: ['Private Covered Garage', 'Ground Floor Access', 'Safe & Secure Parking', 'Suits Cars & Motorcycles'],
      },
    ];

    for (const [i, room] of rooms.entries()) {
      const result = insRoom.run(room.name, room.description, room.image, room.badge, i);
      const roomId = result.lastInsertRowid;
      for (const [j, feat] of room.features.entries()) insFeat.run(roomId, feat, j);
    }
  }

  // Seed amenities if empty
  const amCount = (db.prepare('SELECT COUNT(*) as c FROM amenities').get() as { c: number }).c;
  if (amCount === 0) {
    const insAm = db.prepare('INSERT INTO amenities (icon, title, description, sort_order) VALUES (?, ?, ?, ?)');
    const amenities = [
      { icon: 'directions_car', title: 'Private Garage', description: 'Every unit comes with its own covered parking space.' },
      { icon: 'tv', title: 'Wall-mounted TV', description: 'Relax and unwind with a flat-screen TV mounted in the room.' },
      { icon: 'mode_fan', title: 'Ceiling Fan', description: 'Each room is equipped with a ceiling fan for comfortable airflow.' },
      { icon: 'bed', title: 'Clean Beddings', description: 'Fresh, clean linens and pillows provided for every guest.' },
      { icon: 'bolt', title: '24/7 Electricity', description: 'Reliable power supply throughout your stay, day and night.' },
      { icon: 'weekend', title: 'Lounge Area', description: 'Comfortable sofa and dining area in family rooms.' },
      { icon: 'lock', title: 'Safe & Secure', description: 'Gated compound with secure perimeter walls for your peace of mind.' },
      { icon: 'park', title: 'Garden Surroundings', description: 'Enjoy a calm, green environment with plants and natural surroundings.' },
    ];
    for (const [i, am] of amenities.entries()) insAm.run(am.icon, am.title, am.description, i);
  }

  // Seed gallery if empty
  const galCount = (db.prepare('SELECT COUNT(*) as c FROM gallery').get() as { c: number }).c;
  if (galCount === 0) {
    const insGal = db.prepare('INSERT INTO gallery (src, alt, caption, is_featured, sort_order) VALUES (?, ?, ?, ?, ?)');
    const photos = [
      { src: '/images/entrance.jpg', alt: 'Apartelle entrance and signage', caption: 'Welcome to 559', featured: 1 },
      { src: '/images/garage.jpg', alt: 'Covered garage units', caption: 'Private Covered Garages', featured: 0 },
      { src: '/images/room-sala.jpg', alt: 'Room with living area and TV', caption: 'Spacious Living Area', featured: 0 },
      { src: '/images/room-beds.jpg', alt: 'Room with multiple beds', caption: 'Clean & Comfortable Beds', featured: 0 },
    ];
    for (const [i, p] of photos.entries()) insGal.run(p.src, p.alt, p.caption, p.featured, i);
  }

  // Seed admin user if empty
  const adminCount = (db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number }).c;
  if (adminCount === 0) {
    db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run('admin', hashSync('admin559', 10));
  }
}

// ── Typed helpers ────────────────────────────────────────────────────────────

export type Setting = { key: string; value: string };
export type Room = { id: number; name: string; description: string; image: string; badge: string; sort_order: number; features?: string[] };
export type Amenity = { id: number; icon: string; title: string; description: string; sort_order: number };
export type GalleryPhoto = { id: number; src: string; alt: string; caption: string; is_featured: number; sort_order: number };

export function getSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Setting[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export function getSetting(db: Database.Database, key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(db: Database.Database, key: string, value: string) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function getRooms(db: Database.Database): Room[] {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY sort_order ASC').all() as Room[];
  const featStmt = db.prepare('SELECT feature FROM room_features WHERE room_id = ? ORDER BY sort_order ASC');
  for (const room of rooms) {
    room.features = (featStmt.all(room.id) as { feature: string }[]).map(r => r.feature);
  }
  return rooms;
}

export function getAmenities(db: Database.Database): Amenity[] {
  return db.prepare('SELECT * FROM amenities ORDER BY sort_order ASC').all() as Amenity[];
}

export function getGallery(db: Database.Database): GalleryPhoto[] {
  return db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC').all() as GalleryPhoto[];
}
