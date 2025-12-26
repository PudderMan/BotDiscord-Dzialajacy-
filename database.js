const Database = require('better-sqlite3');
const path = require('path');

// Połączenie z bazą danych
const db = new Database(path.join(__dirname, 'database.sqlite'));

/**
 * Inicjalizacja bazy danych
 * Tworzy tabelę jeśli nie istnieje i sprawdza czy są wszystkie kolumny.
 */
function initDatabase() {
    // 1. Tworzenie podstawowej tabeli
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
            pudelko INTEGER DEFAULT 0
        )
    `).run();

    // 2. Automatyczna migracja (dodawanie kolumn, jeśli ich brakuje w starej bazie)
    const tableInfo = db.prepare("PRAGMA table_info(players)").all();
    const columns = tableInfo.map(col => col.name);

    const requiredColumns = [
        { name: 'pudelko', type: 'INTEGER DEFAULT 0' },
        { name: 'mega_multiplier', type: 'REAL DEFAULT 1' },
        { name: 'fajerwerki_waluta', type: 'INTEGER DEFAULT 0' },
        { name: 'total_fajerwerki', type: 'INTEGER DEFAULT 0' }
    ];

    requiredColumns.forEach(col => {
        if (!columns.includes(col.name)) {
            try {
                db.prepare(`ALTER TABLE players ADD COLUMN ${col.name} ${col.type}`).run();
                console.log(`[Database] Dodano brakującą kolumnę: ${col.name}`);
            } catch (err) {
                console.error(`[Database] Błąd podczas dodawania kolumny ${col.name}:`, err.message);
            }
        }
    });

    console.log("[Database] Baza danych jest gotowa i zaktualizowana.");
}

// Uruchomienie inicjalizacji
initDatabase();

module.exports = db;