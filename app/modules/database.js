const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
  db = new Database(dbPath);

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      room TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      audio_path TEXT,
      duration INTEGER
    );


    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      speaker_label TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      speaker_id INTEGER,
      text TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      confidence REAL,
      is_edited BOOLEAN DEFAULT 0,
      edited_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (speaker_id) REFERENCES participants(id) ON DELETE SET NULL
    );
  `);

  // Migration for existing databases
  try {
    const columns = db.prepare('PRAGMA table_info(meetings)').all();
    const hasAudioPath = columns.some(c => c.name === 'audio_path');
    const hasDuration = columns.some(c => c.name === 'duration');

    if (!hasAudioPath) {
      db.prepare('ALTER TABLE meetings ADD COLUMN audio_path TEXT').run();
    }
    if (!hasDuration) {
      db.prepare('ALTER TABLE meetings ADD COLUMN duration INTEGER').run();
    }
  } catch (e) {
    console.error('Migration error:', e);
  }

  return db;
}

module.exports = {
  initDatabase,
  getDb: () => db
};
