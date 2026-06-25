/**
 * scripts/mockServer.ts
 * Lightweight Express server that simulates the login endpoint.
 * The GitHub Actions job starts this before running Playwright.
 */
import express from 'express';
import Database from 'better-sqlite3';
import * as path from 'path';

const app  = express();
const db   = new Database(path.join(__dirname, '../data/users.db'), { readonly: true });
const PORT = process.env.PORT ?? 3000;

app.get('/api/login', (req, res) => {
  const { username, password } = req.query as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing credentials.' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
    .get(username, password) as { export_status: string; name: string } | undefined;

  if (!user) {
    return res.json({ success: false, message: 'Invalid credentials.' });
  }

  if (user.export_status === 'NON_US_PERSON') {
    return res.json({
      success: false,
      message: 'Only US Persons are allowed to watch this demo.',
      exportStatus: user.export_status,
    });
  }

  return res.json({ success: true, message: 'Login successful.', exportStatus: user.export_status });
});

app.listen(PORT, () => console.log(`Mock server running on http://localhost:${PORT}`));
