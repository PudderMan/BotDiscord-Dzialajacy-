require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./command-loader.js');
const gra = require('./commands/gra.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

client.commands = new Collection();

// Uruchomienie ładowania komend
loadCommands(client);

// Obsługa interakcji
client.on('interactionCreate', async interaction => {
    try {
        // 1. OBSŁUGA KOMEND SLASH
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        }

        // 2. OBSŁUGA PRZYCISKÓW (Logika gry, Sklepu, Zrzutów)
        if (interaction.isButton()) {
            // Przekazujemy interakcję do modułu gry
            if (gra && gra.handleInteraction) {
                await gra.handleInteraction(interaction);
            } else {
                console.error("❌ Moduł gry nie został poprawnie załadowany!");
            }
        }
    } catch (error) {
        console.error('🔴 Wystąpił błąd podczas interakcji:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Wystąpił błąd krytyczny bota!', ephemeral: true });
        }
    }
});

// Logowanie bota
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log(`
    ====================================
    🚀 BOT SYLWESTROWY JEST ONLINE!
    🤖 Zalogowano jako: ${client.user.tag}
    📅 Gotowy na odliczanie do 2026!
    ====================================
    `);
});