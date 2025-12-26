const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'database.sqlite'));

// Funkcja automatycznie naprawiająca bazę
function patchDatabase() {
    const tableInfo = db.prepare("PRAGMA table_info(players)").all();
    const columns = tableInfo.map(c => c.name);

    const required = [
        { name: 'pudelko', type: 'INTEGER DEFAULT 0' },
        { name: 'brawlpass_count', type: 'INTEGER DEFAULT 0' }
    ];

    required.forEach(col => {
        if (!columns.includes(col.name)) {
            console.log(`[Baza] Dodawanie brakującej kolumny: ${col.name}`);
            db.prepare(`ALTER TABLE players ADD COLUMN ${col.name} ${col.type}`).run();
        }
    });
}

db.prepare(`
    CREATE TABLE IF NOT EXISTS players (
        userId TEXT PRIMARY KEY,
        proch REAL DEFAULT 0,
        multiplier REAL DEFAULT 1,
        mega_multiplier REAL DEFAULT 1,
        total_fajerwerki INTEGER DEFAULT 0,
        fajerwerki_waluta INTEGER DEFAULT 0,
        dzik INTEGER DEFAULT 0,
        max_dzik INTEGER DEFAULT 1,
        zimne_ognie INTEGER DEFAULT 0,
        piccolo INTEGER DEFAULT 0,
        szampan INTEGER DEFAULT 0,
        wyrzutnia INTEGER DEFAULT 0,
        pudelko INTEGER DEFAULT 0,
        brawlpass_count INTEGER DEFAULT 0
    )
`).run();

patchDatabase();
module.exports = db;