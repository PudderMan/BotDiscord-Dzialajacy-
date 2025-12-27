require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./command-loader.js');
const gra = require('./commands/gra.js');
// Import systemu eventów
const eventSystem = require('./commands/events-system.js'); 

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

        // 2. OBSŁUGA PRZYCISKÓW
        if (interaction.isButton()) {
            // SPRAWDZENIE: Czy przycisk należy do systemu eventów?
            // Jeśli tak, ignorujemy go tutaj, bo zajmie się nim eventSystem.init()
            if (interaction.customId.startsWith('event_join_')) {
                return; 
            }

            // Obsługa pozostałych przycisków przez moduł gry
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
    client.user.setActivity('wybuchające fajerwerki', { type: 3 });

    console.log(`
    ====================================
    🚀 BOT SYLWESTROWY JEST ONLINE!
    🤖 Zalogowano jako: ${client.user.tag}
    📅 Gotowy na odliczanie do 2026!
    ====================================
    `);

    // Uruchomienie słuchacza przycisków eventowych i pętli czasowej
    if (eventSystem && eventSystem.init) {
        eventSystem.init(client);
    } else {
        console.error("❌ Nie udało się zainicjować systemu eventów!");
    }
});