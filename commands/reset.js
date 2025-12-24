const db = require('./database.js');

console.log('⚠️ Przygotowanie do resetu bazy danych...');

try {
    // Usuwamy wszystkich graczy z tabeli
    db.prepare('DELETE FROM players').run();
    // Opcjonalnie: resetujemy plik bazy (VACUUM zwalnia miejsce)
    db.prepare('VACUUM').run();
    
    console.log('✅ Baza danych została pomyślnie wyczyszczona!');
} catch (error) {
    console.error('❌ Błąd podczas resetu:', error);
}