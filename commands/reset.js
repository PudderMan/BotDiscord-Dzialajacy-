const db = require('../database.js'); // POPRAWKA: Dwie kropki, bo baza jest w folderze wyżej

console.log('⚠️ Resetowanie bazy danych...');
try {
    db.prepare('DELETE FROM players').run();
    console.log('✅ Baza wyczyszczona!');
} catch (e) {
    console.error(e);
}