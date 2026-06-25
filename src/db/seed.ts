/**
 * src/db/seed.ts
 * Initialises the embedded SQLite database and seeds it with test users.
 * Run once with:  npm run db:init
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH ?? './data/users.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    export_status TEXT    NOT NULL CHECK(export_status IN ('US_PERSON','NON_US_PERSON')),
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL
  );
`);

// ── Seed data ─────────────────────────────────────────────────────────────────
//  Passwords are stored as plain text here ONLY for demo / POC purposes.
//  In production, use bcrypt or argon2.
const users = [
  {
    name: 'Captain America',
    export_status: 'US_PERSON',
    username: 'captain.america',
    password_hash: 'Avengers2025!',
  },
  {
    name: 'Green Goblin',
    export_status: 'NON_US_PERSON',
    username: 'green.goblin',
    password_hash: 'OsCorp2025!',
  },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO users (name, export_status, username, password_hash)
  VALUES (@name, @export_status, @username, @password_hash)
`);

const insertMany = db.transaction((rows: typeof users) => {
  for (const row of rows) insert.run(row);
});

insertMany(users);

// ── Verify ────────────────────────────────────────────────────────────────────
const rows = db.prepare('SELECT id, name, export_status, username FROM users').all();
console.log('\n✅  Database seeded successfully!\n');
console.table(rows);

db.close();
