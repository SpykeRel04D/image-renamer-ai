import Database from 'better-sqlite3';
import path from 'node:path';
import type { ImageRecord } from './types.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  original_path TEXT UNIQUE NOT NULL,
  relative_dir  TEXT NOT NULL,
  original_name TEXT NOT NULL,
  extension     TEXT NOT NULL,
  file_size     INTEGER,
  is_svg        INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  ai_description TEXT,
  new_stem      TEXT,
  new_filename  TEXT,
  output_path   TEXT,
  error_message TEXT,
  analyzed_at   TEXT,
  converted_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_status ON images(status);
`;

let db: Database.Database;

export function initDb(outputDir: string): Database.Database {
  const dbPath = path.join(outputDir, '.image-processor-state.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export function crashRecovery(): void {
  const d = getDb();
  d.prepare("UPDATE images SET status = 'pending' WHERE status = 'analyzing'").run();
  d.prepare("UPDATE images SET status = 'analyzed' WHERE status = 'converting'").run();
}

export function insertImage(record: {
  original_path: string;
  relative_dir: string;
  original_name: string;
  extension: string;
  file_size: number;
  is_svg: number;
}): boolean {
  const d = getDb();
  const result = d.prepare(`
    INSERT OR IGNORE INTO images (original_path, relative_dir, original_name, extension, file_size, is_svg)
    VALUES (@original_path, @relative_dir, @original_name, @extension, @file_size, @is_svg)
  `).run(record);
  return result.changes > 0;
}

export function getImagesByStatus(status: string): ImageRecord[] {
  return getDb().prepare('SELECT * FROM images WHERE status = ?').all(status) as ImageRecord[];
}

export function updateImageAnalysis(id: number, data: {
  status: string;
  ai_description: string;
  new_stem: string;
  new_filename: string;
  output_path: string;
}): void {
  getDb().prepare(`
    UPDATE images SET status = @status, ai_description = @ai_description,
    new_stem = @new_stem, new_filename = @new_filename, output_path = @output_path,
    analyzed_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });
}

export function updateImageConverted(id: number): void {
  getDb().prepare(`
    UPDATE images SET status = 'converted', converted_at = datetime('now') WHERE id = ?
  `).run(id);
}

export function updateImageError(id: number, errorMessage: string): void {
  getDb().prepare(`
    UPDATE images SET status = 'error', error_message = ? WHERE id = ?
  `).run(errorMessage, id);
}

export function updateImageStatus(id: number, status: string): void {
  getDb().prepare('UPDATE images SET status = ? WHERE id = ?').run(status, id);
}

export function stemExists(stem: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM images WHERE new_stem = ?').get(stem);
}

export function getAllImages(): ImageRecord[] {
  return getDb().prepare('SELECT * FROM images').all() as ImageRecord[];
}

export function getConvertedImages(): ImageRecord[] {
  return getDb().prepare("SELECT * FROM images WHERE status = 'converted'").all() as ImageRecord[];
}

export function getStatusCounts(): Record<string, number> {
  const rows = getDb().prepare('SELECT status, COUNT(*) as count FROM images GROUP BY status').all() as { status: string; count: number }[];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

export function resetAll(): void {
  getDb().prepare('DELETE FROM images').run();
}

export function closeDb(): void {
  if (db) db.close();
}
