const Database = require('better-sqlite3');
const path = require('path');

// Połączenie z plikiem bazy danych
const db = new Database(path.join(__dirname, 'database.sqlite'));

/**
 * Funkcja inicjalizująca strukturę bazy.
 * Sprawdza każdą kolumnę po kolei, aby uniknąć błędów ze screenów.
 */
function setupDatabase() {
    // 1. Tworzenie tabeli, jeśli w ogóle nie istnieje
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

    // 2. Automatyczna naprawa (MIGRACJA) - dodaje kolumny do starej bazy bez kasowania danych
    const columnsInTable = db.prepare("PRAGMA table_info(players)").all().map(c => c.name);

    // Lista kolumn, które MUSZĄ być w bazie (naprawia błąd ze screena nr 3)
    const columnsToVerify = [
        { name: 'pudelko', type: 'INTEGER DEFAULT 0' },
        { name: 'mega_multiplier', type: 'REAL DEFAULT 1' },
        { name: 'fajerwerki_waluta', type: 'INTEGER DEFAULT 0' },
        { name: 'total_fajerwerki', type: 'INTEGER DEFAULT 0' },
        { name: 'max_dzik', type: 'INTEGER DEFAULT 1' }
    ];

    columnsToVerify.forEach(col => {
        if (!columnsInTable.includes(col.name)) {
            try {
                db.prepare(`ALTER TABLE players ADD COLUMN ${col.name} ${col.type}`).run();
                console.log(`[Baza] Naprawiono brakującą kolumnę: ${col.name}`);
            } catch (err) {
                console.error(`[Baza] Nie udało się dodać kolumny ${col.name}:`, err.message);
            }
        }
    });

    console.log("[Baza] Struktura sprawdzona i gotowa do gry!");
}

// Uruchamiamy naprawę przy każdym starcie bota
setupDatabase();

module.exports = db;