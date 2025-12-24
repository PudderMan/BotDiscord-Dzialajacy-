require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database.js'); // POPRAWKA: Jedna kropka, bo plik jest obok

async function loadCommands(client) {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    
    // Upewnij się, że folder commands istnieje
    if (!fs.existsSync(commandsPath)) return console.error("Folder 'commands' nie istnieje!");

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Rejestrowanie komend...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Komendy zarejestrowane!');
    } catch (error) {
        console.error(error);
    }
}

module.exports = { loadCommands }; // To musi tu być, żeby Bot.js widział funkcję