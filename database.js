const Database = require('better-sqlite3');
const db = new Database('sylwester.db');

// Tworzenie tabeli, jeśli nie istnieje
db.prepare(`
    CREATE TABLE IF NOT EXISTS players (
        userId TEXT PRIMARY KEY,
        proch INTEGER DEFAULT 0,
        multiplier REAL DEFAULT 1,
        zimne_ognie INTEGER DEFAULT 0,
        piccolo INTEGER DEFAULT 0,
        szampan INTEGER DEFAULT 0,
        wyrzutnia INTEGER DEFAULT 0,
        dzik INTEGER DEFAULT 0
    )
`).run();

// Automatyczna aktualizacja tabeli o kolumnę dzik (jeśli jej brakuje)
const tableInfo = db.prepare("PRAGMA table_info(players)").all();
if (!tableInfo.some(column => column.name === 'dzik')) {
    db.prepare("ALTER TABLE players ADD COLUMN dzik INTEGER DEFAULT 0").run();
}

module.exports = db;