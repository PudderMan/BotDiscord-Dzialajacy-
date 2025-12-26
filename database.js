const Database = require('better-sqlite3');
const db = new Database('sylwester.db');

db.prepare(`
    CREATE TABLE IF NOT EXISTS players (
        userId TEXT PRIMARY KEY,
        proch REAL DEFAULT 0,
        multiplier REAL DEFAULT 1,
        mega_multiplier REAL DEFAULT 1,
        zimne_ognie INTEGER DEFAULT 0,
        piccolo INTEGER DEFAULT 0,
        szampan INTEGER DEFAULT 0,
        wyrzutnia INTEGER DEFAULT 0,
        dzik INTEGER DEFAULT 0,
        max_dzik INTEGER DEFAULT 2,
        total_fajerwerki INTEGER DEFAULT 0,
        fajerwerki_waluta INTEGER DEFAULT 0
    )
`).run();

// Skrypt sprawdzający kolumny (na wypadek aktualizacji)
const tableInfo = db.prepare("PRAGMA table_info(players)").all();
const cols = ['mega_multiplier', 'max_dzik', 'total_fajerwerki', 'fajerwerki_waluta'];
cols.forEach(c => {
    if (!tableInfo.some(col => col.name === c)) {
        let def = c.includes('multiplier') ? "1.0" : "0";
        if (c === 'max_dzik') def = "2";
        db.prepare(`ALTER TABLE players ADD COLUMN ${c} REAL DEFAULT ${def}`).run();
    }
});

module.exports = db;