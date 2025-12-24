const Database = require('better-sqlite3');
const db = new Database('sylwester.db');

// Używamy tylko CREATE TABLE IF NOT EXISTS. 
// Jeśli tabela już jest, to polecenie nic nie zrobi i zachowa dane.
db.prepare(`CREATE TABLE IF NOT EXISTS players (
    userId TEXT PRIMARY KEY, 
    proch INTEGER DEFAULT 0, 
    multiplier INTEGER DEFAULT 1,
    zimne_ognie INTEGER DEFAULT 0,
    piccolo INTEGER DEFAULT 0,
    szampan INTEGER DEFAULT 0,
    wyrzutnia INTEGER DEFAULT 0
)`).run();

module.exports = db;